"""
Manufacturing Agentic AI — Report Agent Workflow
=================================================
Implementation exactly follows readonly_agent_report.ipynb:
  Node 1: intent_understanding_node
  Node 2: schema_context_retrieval_node
  Node 3: sql_generation_node         (gemini/gemini-3.5-flash-lite via execute_completion)
  Node 4: sql_execution_node          (MES SQL Server, ;;; multi-query split)
  Node 5: data_profiling_aggregation_node
  Node 6: analysis_insights_node      (gemini/gemini-3.5-flash-lite via execute_completion)
  Node 7: chart_generation_node       (matplotlib → temp PNG → deleted after PDF)
  Node 8: html_report_generation_node (passthrough)
  Node 9: pdf_compilation_node        (ReportLab)
  Fallback: fallback_response_node

LLM model: gemini/gemini-3.5-flash-lite (user calls it "gemini-3.5-flash-lite")
Fallback:   groq/llama-3.3-70b-versatile
Database:   MES SQL Server (via sync_mes_engine from db.py)
"""
import os
import re
import json
import uuid
import asyncio
import logging
from decimal import Decimal
from datetime import date, datetime
from typing import TypedDict, Optional, List, Dict, Any

import pandas as pd
import matplotlib
matplotlib.use("Agg")   # non-interactive backend — safe for server threads
import matplotlib.pyplot as plt

from langgraph.graph import StateGraph, START, END

# ReportLab components
from reportlab.lib.pagesizes import letter
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    Image as RLImage
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

# Backend helpers
from app.llm_gateway import execute_completion
from app.db import sync_mes_engine

logger = logging.getLogger("agent_workflow")

# ---------------------------------------------------------------------------
# Primary LLM model (user's alias "gemini-3.5-flash-lite" → gemini/gemini-3.5-flash-lite)
# ---------------------------------------------------------------------------
PRIMARY_MODEL = "gemini/gemini-3.5-flash-lite"   # resolved by execute_completion

# ---------------------------------------------------------------------------
# MES Database Catalog (exact copy from notebook)
# ---------------------------------------------------------------------------
MES_CATALOG = {
    "Actions": [
        "Id",
        "ActionName",
        "Icon",
        "CssClass"
    ],
    "AlertMaster": [
        "AlertId",
        "AlertType",
        "Severity",
        "Title",
        "Message",
        "Source",
        "SourceId",
        "WorkOrderId",
        "MachineId",
        "IsAcknowledged",
        "AcknowledgedBy",
        "AcknowledgedAt",
        "IsResolved",
        "ResolvedBy",
        "ResolvedAt",
        "ResolutionNotes",
        "CreatedDate",
        "CustomerId",
        "CreatedBy",
        "UpdatedDate",
        "UpdatedBy"
    ],
    "AlternateUnit": [
        "AlternateUnitId",
        "AlternateUnitName",
        "CompanyId",
        "CreatedBy",
        "CreatedOn",
        "UpdatedBy",
        "UpdatedOn"
    ],
    "AssetType": [
        "AssetTypeId",
        "AssetTypeName",
        "CompanyId",
        "CreatedBy",
        "CreatedOn",
        "UpdatedBy",
        "UpdatedOn"
    ],
    "AssetTypeTesting": [
        "AssetTypeId",
        "AssetTypeName",
        "CompanyId",
        "CreatedBy",
        "CreatedOn",
        "UpdatedBy",
        "UpdatedOn"
    ],
    "BinMaster": [
        "BinId",
        "BinName",
        "BinCode",
        "MachineId",
        "Capacity",
        "IsActive",
        "CreatedBy",
        "CreatedOn",
        "UpdatedBy",
        "UpdatedOn",
        "CompanyId",
        "QRCodeUrl",
        "MachineName"
    ],
    "BOMLine": [
        "BOMLineId",
        "BOMId",
        "ComponentId",
        "Quantity",
        "UOM",
        "Sequence",
        "ScrapPercent",
        "IsActive",
        "CustomerId",
        "CreatedBy",
        "CreatedDate",
        "UpdatedBy",
        "UpdatedDate"
    ],
    "BOMMaster": [
        "BOMId",
        "ProductId",
        "BOMVersion",
        "EffectiveFrom",
        "EffectiveTo",
        "Status",
        "Description",
        "IsActive",
        "CustomerId",
        "CreatedBy",
        "CreatedDate",
        "UpdatedBy",
        "UpdatedDate"
    ],
    "CapacityAnalysis": [
        "CapacityId",
        "MachineId",
        "Date",
        "ShiftId",
        "AvailableHours",
        "PlannedHours",
        "ActualHours",
        "UtilizationPercent",
        "OverloadFlag",
        "CustomerId",
        "CreatedBy",
        "CreatedDate",
        "UpdatedBy",
        "UpdatedDate"
    ],
    "Cavity": [
        "CavityId",
        "CavityName",
        "CavityNumber",
        "RawMaterialId",
        "MachineId",
        "FGId",
        "SFGNumber",
        "MessageBox",
        "UpdatedBy",
        "UpdatedOn",
        "CreatedBy",
        "CreatedOn",
        "CompanyId"
    ],
    "ContainerCapacity": [
        "ContainerCapacityId",
        "ContainerCapacityName",
        "CompanyId",
        "CreatedBy",
        "CreatedOn",
        "UpdatedBy",
        "UpdatedOn"
    ],
    "Customer": [
        "CustomerId",
        "CustomerCode",
        "CustomerName",
        "ContactNumber",
        "Email",
        "Address",
        "CityId",
        "StateId",
        "CountryId",
        "CreatedBy",
        "CreatedOn",
        "UpdatedBy",
        "UpdatedOn",
        "CompanyId",
        "IsActive",
        "DeactivatedDate"
    ],
    "CustomerProductMapping_del": [
        "CustomerId",
        "ProductId",
        "IsActive",
        "CreatedBy",
        "CreatedDate",
        "UpdatedDate",
        "UpdatedBy"
    ],
    "ExciseClassification": [
        "ExciseClassificationId",
        "ExciseClassificationName",
        "CompanyId",
        "CreatedBy",
        "CreatedOn",
        "UpdatedBy",
        "UpdatedOn"
    ],
    "FGRMMapping": [
        "Id",
        "FGCode",
        "RMCode",
        "RMName",
        "CreatedBy",
        "CreatedOn",
        "UpdatedBy",
        "UpdatedOn",
        "CompanyId",
        "RMQuantityPerKg",
        "RMGrade"
    ],
    "FGSFGMapping": [
        "Id",
        "FGCode",
        "FGName",
        "SFGCode",
        "SFGName",
        "CreatedBy",
        "CreatedOn",
        "UpdatedBy",
        "UpdatedOn",
        "CompanyId",
        "Type"
    ],
    "FinishedGood": [
        "FGId",
        "RequestId",
        "MaterialCode",
        "MaterialName",
        "Quantity",
        "FGQuantity",
        "BlockedQuantity",
        "NumberOfBags",
        "KGInPerBags",
        "StoreId",
        "UOM",
        "Status",
        "CreatedBy",
        "CreatedOn",
        "UpdatedBy",
        "UpdatedOn",
        "CompanyId",
        "QRCodeUrl",
        "BagName",
        "IsHold",
        "Color",
        "IsDispatch",
        "ReasonForRepackaging",
        "RepackDate",
        "IsActive",
        "Id"
    ],
    "GanttSchedule": [
        "GanttId",
        "WorkOrderId",
        "MachineId",
        "StartDate",
        "EndDate",
        "Duration",
        "Color",
        "Progress",
        "Dependencies",
        "CustomerId",
        "ViewType",
        "ScheduledStart",
        "ScheduledEnd",
        "GanttScheduleId",
        "BarLabel",
        "BarStatus",
        "CreatedBy",
        "CreatedDate",
        "UpdatedBy",
        "UpdatedDate"
    ],
    "Hold": [
        "Id",
        "RequestId",
        "MaterialCode",
        "MaterialName",
        "Quantity",
        "HoldQuantity",
        "UOM",
        "NumberOfBags",
        "KGInPerBags",
        "OutputDate",
        "Status",
        "QRCodeUrl",
        "CreatedBy",
        "CreatedOn",
        "UpdatedBy",
        "UpdatedOn",
        "CompanyId",
        "BagName"
    ],
    "HSNCode": [
        "HSNCodeId",
        "HSNCodeName",
        "CompanyId",
        "CreatedBy",
        "CreatedOn",
        "UpdatedBy",
        "UpdatedOn"
    ],
    "Inventory": [
        "Id",
        "MaterialCode",
        "Category",
        "BlockedQuantity",
        "QuantityInStock",
        "UpdatedOn",
        "UpdatedBy",
        "CreatedBy",
        "CreatedOn",
        "CompanyId",
        "StockUpdatedReason"
    ],
    "InventoryByLot": [
        "InventoryId",
        "ProductId",
        "LotId",
        "WarehouseCode",
        "LocationCode",
        "Quantity",
        "ReservedQty",
        "LastUpdated",
        "CustomerId",
        "CreatedBy",
        "CreatedDate",
        "UpdatedBy",
        "UpdatedDate"
    ],
    "ItemCategory": [
        "ItemCategoryId",
        "ItemCategoryCode",
        "ItemCategoryName",
        "CreatedBy",
        "CreatedOn",
        "UpdatedBy",
        "UpdatedOn",
        "CompanyId"
    ],
    "ItemColour": [
        "ItemColourId",
        "ItemColourName",
        "CompanyId",
        "CreatedBy",
        "CreatedOn",
        "UpdatedBy",
        "UpdatedOn"
    ],
    "ItemGroup": [
        "ItemGroupId",
        "ItemGroupCode",
        "ItemGroupName",
        "CompanyId",
        "CreatedBy",
        "CreatedOn",
        "UpdatedBy",
        "UpdatedOn"
    ],
    "ItemMake": [
        "ItemMakeId",
        "ItemMakeName",
        "CompanyId",
        "CreatedBy",
        "CreatedOn",
        "UpdatedBy",
        "UpdatedOn"
    ],
    "ItemType": [
        "ItemTypeId",
        "ItemTypeName",
        "CompanyId",
        "CreatedBy",
        "CreatedOn",
        "UpdatedBy",
        "UpdatedOn"
    ],
    "JumboPackaging": [
        "Id",
        "RequestId",
        "PackagingType",
        "ScrapQuantity",
        "KGInPerBag",
        "NumberOfBags",
        "Status",
        "Date",
        "UpdatedBy",
        "UpdatedOn",
        "CreatedBy",
        "CreatedOn",
        "CompanyId",
        "QRCodeUrl",
        "StoreId",
        "RejectedQuantity",
        "BagName",
        "Color",
        "UOM",
        "CustomerName",
        "Category",
        "TotalQuantity",
        "IsCompleted"
    ],
    "LotMaster": [
        "LotId",
        "LotNumber",
        "ProductId",
        "ManufactureDate",
        "ExpiryDate",
        "Status",
        "CustomerId",
        "CreatedBy",
        "CreatedDate",
        "UpdatedBy",
        "UpdatedDate"
    ],
    "Machine": [
        "MachineId",
        "MachineName",
        "MachineCode",
        "MachineType",
        "Model",
        "AverageWeight",
        "PieceOrBox",
        "BoxWeight",
        "Status",
        "Capacity",
        "LastServiceDate",
        "NextServiceDue",
        "ProductionPerDay",
        "CreatedBy",
        "CreatedOn",
        "UpdatedBy",
        "UpdatedOn",
        "CompanyId",
        "QRCodeUrl",
        "FGName"
    ],
    "MachineFGMapping": [
        "Id",
        "MachineType",
        "FGCode",
        "FGName",
        "CreatedBy",
        "CreatedOn",
        "UpdatedBy",
        "UpdatedOn",
        "CompanyId",
        "CycleTime",
        "AverageWeight",
        "NoOfCavities"
    ],
    "MachineMaster": [
        "MachineId",
        "MachineCode",
        "MachineName",
        "MachineType",
        "Location",
        "CapacityPerHour",
        "AvailableHoursPerDay",
        "EfficiencyPercent",
        "Status",
        "IsActive",
        "CustomerId",
        "CreatedBy",
        "CreatedDate",
        "UpdatedBy",
        "UpdatedDate",
        "Capacity",
        "MinCapacity",
        "MaxCapacity",
        "LastMaintDate",
        "NextMaintDate",
        "Shift",
        "Utilization",
        "WorkCenter",
        "Role",
        "Skills"
    ],
    "MachineMaterialMapping": [
        "Id",
        "MachineId",
        "RMCode",
        "SFGCode",
        "FGCode",
        "CreatedBy",
        "CreatedOn",
        "UpdatedBy",
        "UpdatedOn",
        "CompanyId"
    ],
    "MaintenanceWindow": [
        "MaintenanceId",
        "MachineId",
        "MaintenanceType",
        "StartDate",
        "EndDate",
        "Description",
        "Status",
        "CustomerId",
        "Title",
        "AlertType",
        "DurationHours",
        "WorkCenterCode",
        "CreatedBy",
        "CreatedDate",
        "UpdatedBy",
        "UpdatedDate"
    ],
    "MaterialDispatch": [
        "Id",
        "SONumber",
        "CustomerCode",
        "NumberOfBags",
        "KGInPerBags",
        "MonthYear",
        "Quantity",
        "UOM",
        "CreatedBy",
        "CreatedOn",
        "UpdatedBy",
        "UpdatedOn",
        "CompanyId",
        "QRCodeUrl",
        "Status",
        "DispatchDate",
        "TotalQuantity",
        "LoadedQuantity",
        "UnloadedQuantity",
        "Comments",
        "FinalDispatchQty"
    ],
    "Materials": [
        "MaterialCode",
        "ReferenceNo",
        "MaterialName",
        "PrintName",
        "DisplayName",
        "NameInTally",
        "Description",
        "ItemGroup",
        "ItemCategory",
        "AssetType",
        "ServiceType",
        "DefaultStoreName",
        "MeasurementUnit",
        "AlternateUnit",
        "PackingUnit",
        "PackingSize",
        "BaseConversionRatio",
        "AlternateConversionRatio",
        "SellingPrice",
        "MinimumStock",
        "MaximumStock",
        "ExciseClassification",
        "ItemType",
        "NeckType",
        "Colour",
        "SpareType",
        "PlasticMaterialType",
        "PlasticCategory",
        "ContainerCapacity",
        "Tolerance",
        "DefaultLocation",
        "CreatedBy",
        "CreatedOn",
        "UpdatedBy",
        "UpdatedOn",
        "CompanyId",
        "RMGrade"
    ],
    "MaterialTransit": [
        "Id",
        "MaterialCode",
        "Quantity",
        "InTransit",
        "CreatedBy",
        "CreatedOn",
        "UpdatedBy",
        "UpdatedOn",
        "CompanyId",
        "MaterialName"
    ],
    "MeasurementUnit": [
        "MeasurementUnitId",
        "MeasurementUnitName",
        "AlternateUnit",
        "CompanyId",
        "CreatedBy",
        "CreatedOn",
        "UpdatedBy",
        "UpdatedOn"
    ],
    "MPSHeader": [
        "MpsHeaderId",
        "MpsNumber",
        "Description",
        "PlanningPeriod",
        "StartDate",
        "EndDate",
        "Status",
        "ApprovedBy",
        "ApprovedDate",
        "IsActive",
        "CustomerId",
        "CreatedBy",
        "CreatedDate",
        "UpdatedBy",
        "UpdatedDate"
    ],
    "MpsMaster": [
        "MpsId",
        "MpsHeaderId",
        "ProductId",
        "PlannedQty",
        "PeriodType",
        "PeriodStart",
        "PeriodEnd",
        "DueDate",
        "DemandSource",
        "SalesOrderRef",
        "Status",
        "IsConverted",
        "WorkOrderId",
        "Notes",
        "IsActive",
        "CustomerId",
        "CreatedBy",
        "CreatedDate",
        "UpdatedBy",
        "UpdatedDate",
        "PlantId",
        "ProductCode",
        "Forecast",
        "PlannedOrders",
        "ProductionQty",
        "Week1",
        "Week2",
        "Week3",
        "Week4",
        "ProjectedStock",
        "MachineName",
        "CapacityMode",
        "CapacityValue",
        "Version",
        "WeeklyPlan"
    ],
    "MPSRawMaterialRequirement": [
        "Id",
        "MpsId",
        "ProductId",
        "MaterialId",
        "RMCode",
        "RMName",
        "QtyPerFG",
        "FGQty",
        "RequiredQty",
        "AvailableStock",
        "ShortageQty",
        "Status",
        "CompanyId",
        "PlantId",
        "CreatedBy",
        "CreatedOn",
        "UpdatedBy",
        "UpdatedOn"
    ],
    "MRP_Demand": [
        "DemandId",
        "MrpRunId",
        "ProductId",
        "DemandSource",
        "SourceReference",
        "RequiredQty",
        "RequiredDate",
        "CustomerId",
        "CreatedBy",
        "CreatedDate",
        "UpdatedBy",
        "UpdatedDate"
    ],
    "MRP_Result": [
        "ResultId",
        "MrpRunId",
        "ProductId",
        "ActionType",
        "SuggestedQty",
        "SuggestedDate",
        "CurrentStock",
        "ShortageQty",
        "IsAccepted",
        "WorkOrderId",
        "CustomerId",
        "CreatedBy",
        "CreatedDate",
        "UpdatedBy",
        "UpdatedDate"
    ],
    "MRP_Run": [
        "MrpRunId",
        "RunNumber",
        "RunDate",
        "PlanningHorizonDays",
        "Status",
        "TotalDemands",
        "TotalSuggestions",
        "CompletedDate",
        "RunBy",
        "CustomerId",
        "CreatedBy",
        "CreatedDate",
        "UpdatedBy",
        "UpdatedDate"
    ],
    "NeckType": [
        "NeckTypeId",
        "NeckTypeName",
        "NeckDescription",
        "ParentNeckName",
        "CreatedBy",
        "CreatedOn",
        "UpdatedBy",
        "UpdatedOn",
        "CompanyId"
    ],
    "NotificationRule": [
        "RuleId",
        "RuleName",
        "AlertType",
        "Condition",
        "Recipients",
        "NotifyEmail",
        "NotifySMS",
        "NotifyInApp",
        "IsActive",
        "CustomerId",
        "CreatedBy",
        "UpdatedBy",
        "CreatedDate",
        "UpdatedDate",
        "EscalationMinutes"
    ],
    "OnlineHold": [
        "Id",
        "RequestId",
        "MaterialCode",
        "MaterialName",
        "Quantity",
        "OnlineHoldQuantity",
        "UOM",
        "NumberOfBags",
        "KGInPerBags",
        "OutputDate",
        "Status",
        "StoreId",
        "QRCodeUrl",
        "CreatedBy",
        "CreatedOn",
        "UpdatedBy",
        "UpdatedOn",
        "CompanyId",
        "BagName",
        "Color"
    ],
    "OperatorMaster": [
        "OperatorId",
        "OperatorCode",
        "OperatorName",
        "Department",
        "Skill",
        "ShiftId",
        "IsActive",
        "CustomerId",
        "CreatedBy",
        "CreatedDate",
        "UpdatedBy",
        "UpdatedDate",
        "Role",
        "Shift",
        "Skills",
        "Status",
        "Utilization",
        "WorkCenter"
    ],
    "PackagingType": [
        "PackagingTypeId",
        "PackagingTypeName",
        "Capacity",
        "CompanyId",
        "CreatedOn",
        "CreatedBy",
        "UpdatedOn",
        "UpdatedBy"
    ],
    "PlasticCategory": [
        "PlasticCategoryId",
        "PlasticCategoryName",
        "CompanyId",
        "CreatedBy",
        "CreatedOn",
        "UpdatedBy",
        "UpdatedOn"
    ],
    "PlasticMaterialType": [
        "PlasticTypeId",
        "PlasticTypeName",
        "CompanyId",
        "CreatedBy",
        "CreatedOn",
        "UpdatedBy",
        "UpdatedOn"
    ],
    "PODetails": [
        "PONumber",
        "Quantity",
        "UnitOfMeasurement",
        "VendorCode",
        "MaterialCode",
        "MaterialName",
        "RMGradeId",
        "Price",
        "Status",
        "RejectedReason",
        "PODate",
        "CreatedBy",
        "CreatedOn",
        "UpdatedOn",
        "UpdatedBy",
        "CompanyId",
        "BillRate"
    ],
    "PriorityMaster": [
        "PriorityId",
        "PriorityCode",
        "PriorityName",
        "PriorityLevel",
        "Color",
        "Description",
        "IsActive",
        "CustomerId",
        "CreatedBy",
        "CreatedDate",
        "UpdatedBy",
        "UpdatedDate",
        "PriorityWeight",
        "SlaHours"
    ],
    "Product_del": [
        "ProductId",
        "ProductName",
        "ProductCode",
        "Category",
        "BrandName",
        "Tags",
        "Description",
        "IsActive",
        "CreatedBy",
        "CreatedOn",
        "UpdatedBy",
        "UpdatedOn",
        "Price",
        "StockQuantity",
        "FGId",
        "CompanyId"
    ],
    "ProductionPlanning": [
        "Id",
        "MachineId",
        "FGQuantity",
        "FGCode",
        "FGName",
        "RMCode",
        "RMName",
        "RMQuantity",
        "QuantityInMT",
        "Color",
        "PackagingType",
        "InstructionForOperation",
        "MarketingRemarks",
        "RemarksByProduction",
        "Date",
        "InputQuantity",
        "InputDate",
        "NumberOfBags",
        "KGInPerBag",
        "CreatedBy",
        "CreatedOn",
        "UpdatedOn",
        "UpdatedBy",
        "CompanyId",
        "QRCodeUrl",
        "Status",
        "RMBagName",
        "MachineCode"
    ],
    "ProductMaster": [
        "ProductId",
        "ProductCode",
        "ProductName",
        "ProductType",
        "UOM",
        "Description",
        "StandardCost",
        "LeadTimeDays",
        "SafetyStock",
        "IsActive",
        "CustomerId",
        "CreatedBy",
        "CreatedDate",
        "UpdatedBy",
        "UpdatedDate"
    ],
    "PurchaseReturn": [
        "Id",
        "TransactionID",
        "PONumber",
        "PartyInvoiceNo",
        "PartyInvoiceDate",
        "ItemName",
        "ItemCode",
        "ReturnQty",
        "CreatedBy",
        "CreatedOn",
        "UpdatedBy",
        "UpdatedOn",
        "CompanyId",
        "PurchaseReturnDate",
        "NumberOfBags"
    ],
    "RawMaterial": [
        "RawMaterialId",
        "RawMaterialName",
        "PackagingType",
        "RawMaterialGrade",
        "RawMaterialWeight",
        "VendorId",
        "CreatedBy",
        "CreatedOn",
        "UpdatedBy",
        "UpdatedOn",
        "CompanyId"
    ],
    "RawMaterial_FG_SFGMapping": [
        "RawMaterialId",
        "FGName",
        "SFGName",
        "CreatedBy",
        "CreatedOn",
        "UpdatedBy",
        "UpdatedOn",
        "CompanyId",
        "IsActive"
    ],
    "Rejected": [
        "Id",
        "RequestId",
        "MaterialCode",
        "MaterialName",
        "Quantity",
        "RejectedQuantity",
        "UOM",
        "NumberOfBags",
        "KGInPerBags",
        "OutputDate",
        "Status",
        "StoreId",
        "QRCodeUrl",
        "CreatedBy",
        "CreatedOn",
        "UpdatedBy",
        "UpdatedOn",
        "CompanyId",
        "BagName",
        "Color",
        "ReasonForRepackaging",
        "RepackDate"
    ],
    "Repackaging": [
        "Id",
        "RequestId",
        "MaterialCode",
        "MaterialName",
        "Quantity",
        "NumberOfBags",
        "KGInPerBag",
        "BagName",
        "Remarks",
        "Date",
        "CompanyId",
        "UpdatedBy",
        "UpdatedOn",
        "CreatedBy",
        "CreatedOn",
        "CustomerName",
        "UOM",
        "Color",
        "QRCodeUrl",
        "SONumber",
        "Status",
        "IsActive",
        "FGId"
    ],
    "ReturnData": [
        "ReturnId",
        "MaterialCode",
        "MaterialName",
        "QuantityReturned",
        "NumberOfBags",
        "KGInPerBag",
        "BagName",
        "Remarks",
        "Date",
        "CompanyId",
        "UpdatedBy",
        "UpdatedOn",
        "CreatedBy",
        "CreatedOn",
        "CustomerName",
        "UOM",
        "Color",
        "SONumber",
        "DispatchNumber",
        "DispatchQuantity",
        "FGId",
        "IsActive"
    ],
    "RMGrade": [
        "RMGradeId",
        "RMGradeName",
        "CreatedBy",
        "CreatedOn",
        "UpdatedBy",
        "UpdatedOn",
        "CompanyId"
    ],
    "RMInvoice": [
        "PONumber",
        "ItemCode",
        "ItemName",
        "BillRate",
        "BillBaseQuantity",
        "ReceivedQuantity",
        "InvoiceNumber",
        "InvoiceDate",
        "Price",
        "CreatedBy",
        "CreatedOn",
        "UpdatedBy",
        "UpdatedOn",
        "CompanyId",
        "SendToERP",
        "SendOn"
    ],
    "RMInward": [
        "Id",
        "PONumber",
        "ItemCode",
        "ItemName",
        "BillBaseQuantity",
        "RMGradeId",
        "InvoiceNumber",
        "InvoiceDate",
        "VehicleNumber",
        "PendingQuantity",
        "BatchId",
        "Specification",
        "ReceivedQuantity",
        "ReceivedQuantityUnit",
        "LotNumber",
        "RMInwardDate",
        "Price",
        "NumberOfBags",
        "KGInPerBags",
        "Status",
        "StoreId",
        "StoreAssignedDate",
        "MaterialConditions",
        "QRCodeUrl",
        "CreatedBy",
        "CreatedOn",
        "UpdatedBy",
        "UpdatedOn",
        "CompanyId",
        "RejectedQuantity",
        "ApprovedQuantity",
        "AvailableQuantity",
        "ApprovedNumberOfBags",
        "RejectedNumberOfBags",
        "ReturnQuantity",
        "RMHoldQuantity",
        "HoldNumberOfBags",
        "BillRate",
        "OrderRate"
    ],
    "RMInwardDetails": [
        "Id",
        "RequestId",
        "ItemCode",
        "ItemName",
        "QuantityInPerBag",
        "QRCodeUrl",
        "IsScanned",
        "CreatedBy",
        "CreatedOn",
        "UpdatedBy",
        "UpdatedOn",
        "CompanyId",
        "BagName",
        "Comments",
        "Category",
        "Status",
        "IsPriority"
    ],
    "RoutingMaster": [
        "RoutingId",
        "ProductId",
        "RoutingCode",
        "RoutingName",
        "Version",
        "TotalTimeMinutes",
        "Status",
        "IsActive",
        "CustomerId",
        "CreatedBy",
        "CreatedDate",
        "UpdatedBy",
        "UpdatedDate",
        "OperationSeq",
        "WorkCenterId",
        "StdCycleTime"
    ],
    "RoutingStep": [
        "RoutingStepId",
        "RoutingTemplateId",
        "Seq",
        "Operation",
        "WorkCenter",
        "Machine",
        "SetupTime",
        "RunTime",
        "WaitTime",
        "TotalTime",
        "Skill",
        "Status",
        "CustomerId",
        "CreatedBy",
        "CreatedDate",
        "UpdatedBy",
        "UpdatedDate"
    ],
    "RoutingTemplate": [
        "RoutingTemplateId",
        "TemplateCode",
        "TemplateName",
        "ProductCode",
        "Version",
        "Status",
        "CustomerId",
        "CreatedDate",
        "UpdatedDate",
        "CreatedBy",
        "UpdatedBy"
    ],
    "SalesForecastHeader": [
        "Id",
        "SalePersonId",
        "MonthYear",
        "Status",
        "CreatedBy",
        "CreatedOn",
        "UpdatedBy",
        "UpdatedOn",
        "CompanyId",
        "CustomerId"
    ],
    "SalesForecasts": [
        "Id",
        "RequestId",
        "CustomerCode",
        "MaterialCode",
        "MonthYear",
        "AutoCalculateQuantity",
        "ForecastQuantity",
        "PreviousMonthQuantity",
        "LastYearQuantity",
        "AdjustedQuantity",
        "CreatedBy",
        "CreatedOn",
        "UpdatedBy",
        "UpdatedOn",
        "CompanyId",
        "Price",
        "Amount",
        "WasEdited"
    ],
    "SalesOrder": [
        "SalesOrderId",
        "SONumber",
        "CustomerCode",
        "MaterialCode",
        "OrderQuantity",
        "UOM",
        "OrderDate",
        "Status",
        "TotalAmount",
        "Discount",
        "Tax",
        "NetAmount",
        "PaymentMethod",
        "ShippingAddress",
        "BillingAddress",
        "CreatedBy",
        "CreatedOn",
        "UpdatedBy",
        "UpdatedOn",
        "CompanyId",
        "IsActive",
        "PlannedDispatchDate",
        "ReasonForDateChanged"
    ],
    "SalesPerson": [
        "SalesPersonId",
        "FullName",
        "EmployeeCode",
        "Email",
        "PhoneNumber",
        "AlternatePhone",
        "Address",
        "CityId",
        "StateId",
        "CountryId",
        "PostalCode",
        "TargetSales",
        "AchievedSales",
        "ManagerId",
        "Designation",
        "TotalSales",
        "PerformanceRating",
        "AnnualBonus",
        "IsActive",
        "CreatedOn",
        "CreatedBy",
        "UpdatedOn",
        "UpdatedBy",
        "CompanyId"
    ],
    "SalesPersonCustomerMapping": [
        "SalesPersonId",
        "CustomerId",
        "CustomerCode",
        "IsActive",
        "CreatedBy",
        "CreatedDate",
        "UpdatedBy",
        "UpdatedDate",
        "CompanyId"
    ],
    "SalesPersonQtyBlocked": [
        "ID",
        "SalespersonId",
        "SalespersonName",
        "BlockedQunatity",
        "MaterialCode",
        "MaterialName",
        "CompanyId",
        "UpdatedBy",
        "UpdatedOn",
        "CreatedBy",
        "IsReleased",
        "CreatedOn"
    ],
    "SampleDetails": [
        "Id",
        "CustomerCode",
        "MaterialCode",
        "Quantity",
        "MonthYear",
        "CreatedBy",
        "CreatedOn",
        "UpdatedBy",
        "UpdatedOn",
        "CompanyId",
        "SalesPersonId",
        "Price",
        "Amount",
        "SampleSentOn"
    ],
    "Scrap": [
        "Id",
        "RequestId",
        "MaterialCode",
        "MaterialName",
        "Quantity",
        "ScrapQuantity",
        "UOM",
        "NumberOfBagsScrap",
        "KGInPerBagsScrap",
        "OutputDate",
        "Status",
        "StoreId",
        "PackagingType",
        "QRCodeUrl",
        "CreatedBy",
        "CreatedOn",
        "UpdatedBy",
        "UpdatedOn",
        "CompanyId",
        "BagName",
        "Color"
    ],
    "ScrapDispatch": [
        "Id",
        "RequestId",
        "VehicleNumber",
        "VehicleType",
        "NumberOfBags",
        "TotalQuantity",
        "KGInPerBag",
        "UOM",
        "Status",
        "DispatchDate",
        "UpdatedBy",
        "UpdatedOn",
        "CreatedBy",
        "CreatedOn",
        "CompanyId",
        "QRCodeUrl"
    ],
    "SemiFinishedGood": [
        "SFGId",
        "RequestId",
        "MaterialCode",
        "MaterialName",
        "Quantity",
        "SFGQuantity",
        "OutputDate",
        "UOM",
        "NumberOfBags",
        "KGInPerBags",
        "StoreId",
        "ToleranceLevelId",
        "MachineId",
        "RawMaterialId",
        "Status",
        "CreatedBy",
        "CreatedOn",
        "UpdatedBy",
        "UpdatedOn",
        "CompanyId",
        "QRCodeUrl",
        "BagName",
        "Color",
        "ReasonForRepackaging",
        "RepackDate"
    ],
    "ServiceType": [
        "ServiceTypeId",
        "ServiceTypeName",
        "CompanyId",
        "CreatedBy",
        "CreatedOn",
        "UpdatedBy",
        "UpdatedOn"
    ],
    "ShiftCalendar": [
        "ShiftCalendarId",
        "Date",
        "ShiftId",
        "MachineId",
        "IsWorkingDay",
        "IsHoliday",
        "HolidayName",
        "AvailableHours",
        "CustomerId",
        "DayType",
        "Remarks",
        "CreatedBy",
        "CreatedDate",
        "UpdatedBy",
        "UpdatedDate"
    ],
    "ShiftMaster": [
        "ShiftId",
        "ShiftCode",
        "ShiftName",
        "StartTime",
        "EndTime",
        "BreakMinutes",
        "IsActive",
        "CustomerId",
        "WorkCenterCode",
        "OperatorCount",
        "Status",
        "CreatedBy",
        "CreatedDate",
        "UpdatedBy",
        "UpdatedDate",
        "Operators"
    ],
    "SpareType": [
        "SpareTypeId",
        "SpareTypeName",
        "CompanyId",
        "CreatedBy",
        "CreatedOn",
        "UpdatedBy",
        "UpdatedOn"
    ],
    "Store": [
        "StoreId",
        "StoreName",
        "PlantId",
        "YardId",
        "LocationId",
        "StoreManagerId",
        "InWardManagerId",
        "ManagerId",
        "CreatedBy",
        "CreatedOn",
        "UpdatedBy",
        "UpdatedOn",
        "CompanyId"
    ],
    "TentativeRMPlan": [
        "Id",
        "Segment",
        "RMGrade",
        "RequirementInMT",
        "StockInHand",
        "MinimumStockLevel",
        "MaterialInTransit",
        "FinalRequirement",
        "MonthYear",
        "WeekNumber",
        "CreatedBy",
        "CreatedOn",
        "UpdatedBy",
        "UpdatedOn",
        "CompanyId"
    ],
    "ToleranceLevel": [
        "ToleranceLevelId",
        "ToleranceName",
        "MinValue",
        "MaxValue",
        "UnitOfMeasure",
        "Description",
        "CreatedBy",
        "CreatedOn",
        "UpdatedBy",
        "UpdatedOn",
        "CompanyId"
    ],
    "ToolingMaster": [
        "ToolId",
        "ToolCode",
        "ToolName",
        "ToolType",
        "AssignedToMachineCode",
        "AssignedToMachineId",
        "LifeUsed",
        "LifeTotal",
        "LastChangeDate",
        "NextChangeDate",
        "Status",
        "IsActive",
        "CustomerId",
        "CreatedDate",
        "UpdatedDate",
        "UpdatedBy",
        "CreatedBy"
    ],
    "UnPack": [
        "Id",
        "RequestId",
        "MaterialCode",
        "MaterialName",
        "Quantity",
        "NumberOfBags",
        "KGInPerBag",
        "BagName",
        "Remarks",
        "CompanyId",
        "UpdatedBy",
        "UpdatedOn",
        "CreatedBy",
        "CreatedOn",
        "UOM",
        "Color",
        "SONumber",
        "Status",
        "Date"
    ],
    "VehicleDetails": [
        "Id",
        "RequestId",
        "VehicleNumber",
        "VehicleType",
        "MaterialCode",
        "MaterialName",
        "Status",
        "LoadQuantity",
        "UnloadQuantity",
        "LoadedBags",
        "UnloadedBags",
        "KGInPerBag",
        "CreatedBy",
        "CreatedOn",
        "UpdatedBy",
        "UpdatedOn",
        "CompanyId",
        "FGId"
    ],
    "Vendors": [
        "VendorId",
        "VendorName",
        "PhoneNumber",
        "EmailAddress",
        "VendorCode",
        "Address",
        "VehicleNumber",
        "VendorCIN",
        "VendorGST",
        "CompanyWebsite",
        "IsActive",
        "CreatedBy",
        "CreatedOn",
        "UpdatedOn",
        "UpdatedBy",
        "PackagingTypeId",
        "CompanyId"
    ],
    "WeeklyPlanning": [
        "Id",
        "MaterialCode",
        "MonthYear",
        "WeekNumber",
        "Next10DaysRequirement",
        "RequiredProduction",
        "QtyInStock",
        "PlannedQty",
        "CreatedBy",
        "CreatedOn",
        "UpdatedBy",
        "UpdatedOn",
        "CompanyId"
    ],
    "WeighingMachine": [
        "Id",
        "FGQuantity",
        "SFGQuantity",
        "RejectedQuantity",
        "ScrapQuantity",
        "OnlineHoldQuantity",
        "MachineCode",
        "CreatedOn",
        "IsActive",
        "ShiftName",
        "ShiftStartTime",
        "ShiftEndTime"
    ],
    "WIPRMRequest": [
        "Id",
        "ItemCode",
        "RequestedQuantity",
        "UOM",
        "ReleasedQuantity",
        "ReceivedQuantity",
        "StoreId",
        "StoreName",
        "CreatedBy",
        "CreatedOn",
        "UpdatedOn",
        "UpdatedBy",
        "CompanyId",
        "Status"
    ],
    "WIPStorage": [
        "Id",
        "ParentRequestId",
        "MachineCode",
        "RMCode",
        "RMName",
        "FGCode",
        "FGName",
        "Remarks",
        "FGQuantity",
        "UOM",
        "RMQuantity",
        "InputDate",
        "InputQuantity",
        "Status",
        "CreatedBy",
        "CreatedOn",
        "UpdatedBy",
        "UpdatedOn",
        "CompanyId",
        "QRCodeUrl",
        "FGNumberOfBags",
        "KGInPerBag",
        "SFGQuantity",
        "SFGNumberOfBags",
        "ScrapQuantity",
        "ScrapNumberOfBags",
        "RejectedQuantity",
        "RejectedNumberOfBags",
        "OnlineHoldQuantity",
        "OnlineHoldNumberOfBags",
        "SFGCode",
        "SFGName",
        "FinishedQuantity",
        "NumberOfBags",
        "Color",
        "RMBagName",
        "CurrentMachineStep",
        "Machine1Name",
        "Machine1InputQty",
        "Machine1OutputQty",
        "Machine2Name",
        "Machine2InputQty",
        "Machine2OutputQty",
        "Machine3Name",
        "Machine3InputQty",
        "Machine2Bins",
        "Machine3Bins",
        "MachineId",
        "ItemCode",
        "RMGradeId",
        "RequestedQuantity",
        "IssuedQuantity",
        "IssueDate",
        "RemainingQuantity",
        "QuantityInMachine",
        "OutputDate"
    ],
    "WIPStorageLocation": [
        "WIPStorageLocationId",
        "ItemName",
        "ItemCode",
        "NumberOfBags",
        "KGInPerBag",
        "ReceivedQuantity",
        "ReceivedDate",
        "UOM",
        "Remarks",
        "CompanyId",
        "CreatedBy",
        "CreatedOn",
        "UpdatedBy",
        "UpdatedOn",
        "RemainingQuantity",
        "BagName",
        "ProductionPlanningRequestId"
    ],
    "WorkflowActionTemplate": [
        "StepId",
        "ActionId",
        "ActionName",
        "NextStep",
        "TargetStepId",
        "NotificationTemplate",
        "SendNotification",
        "CloseWorkflow",
        "WarningMessage",
        "CommentRequired",
        "AttachmentRequired",
        "AttachmentMandatory",
        "WorkflowType"
    ],
    "WorkflowAgentsTemplate": [
        "StepId",
        "AgentGroupName",
        "Id",
        "IsActive",
        "SLADays",
        "WorkflowType"
    ],
    "WorkflowHistory": [
        "Id",
        "RequestId",
        "WorkStepId",
        "WorkStepName",
        "WorkStepDescription",
        "Remarks",
        "ActionTakenBy",
        "ActionDate",
        "CurrentStatus",
        "CurrentStatusName",
        "ActionName",
        "ActionComment",
        "ActionById"
    ],
    "WorkflowStepsTemplate": [
        "StepId",
        "Id",
        "FormUrl",
        "StepName",
        "StepDescription",
        "Active",
        "LocationId",
        "SLADays",
        "WorkflowType"
    ],
    "WorkOrder": [
        "WorkOrderId",
        "WorkOrderNumber",
        "MpsId",
        "ProductId",
        "PlannedQty",
        "CompletedQty",
        "UOM",
        "DueDate",
        "PriorityId",
        "RoutingId",
        "BomId",
        "MachineId",
        "OperatorId",
        "ShiftId",
        "PlannedStart",
        "PlannedEnd",
        "ActualStart",
        "ActualEnd",
        "PlannedDurationHours",
        "ActualDurationHours",
        "Status",
        "CurrentStep",
        "ProgressPercent",
        "HasException",
        "ExceptionCount",
        "CustomerId",
        "CustomerOrderRef",
        "BomVersion",
        "ReleasedDate",
        "ReleasedBy",
        "CancelReasonCode",
        "CancelReasonNotes",
        "CancelledDate",
        "Notes",
        "CreatedBy",
        "CreatedDate",
        "UpdatedBy",
        "UpdatedDate"
    ],
    "WorkOrderBOM": [
        "WorkOrderBOMId",
        "WorkOrderId",
        "ComponentId",
        "Quantity",
        "UOM",
        "IssuedQty",
        "ConsumedQty",
        "ScrapQty",
        "Status",
        "CustomerId",
        "AllocatedQty",
        "RequiredQty",
        "ComponentProductId",
        "CreatedBy",
        "CreatedDate",
        "UpdatedBy",
        "UpdatedDate"
    ],
    "WorkOrderChangeLog": [
        "ChangeLogId",
        "WorkOrderId",
        "ChangeType",
        "FieldChanged",
        "OldValue",
        "NewValue",
        "ChangeReason",
        "ChangedBy",
        "ChangedAt",
        "CustomerId"
    ],
    "WorkOrderLog": [
        "WorkOrderLogId",
        "WorkOrderId",
        "EntryType",
        "Severity",
        "Title",
        "Description",
        "Author",
        "IsSystemGenerated",
        "Timestamp",
        "IsResolved",
        "ResolvedAt",
        "ResolvedBy",
        "ResolutionNote",
        "AlertId",
        "CustomerId",
        "CreatedDate",
        "CreatedBy",
        "UpdatedDate",
        "UpdatedBy"
    ],
    "WorkOrderResource": [
        "WorkOrderResourceId",
        "WorkOrderId",
        "ResourceType",
        "ResourceId",
        "StepSequence",
        "HoursCommitted",
        "Shift",
        "Status",
        "CustomerId",
        "CreatedDate",
        "CreatedBy",
        "UpdatedBy",
        "UpdatedDate"
    ],
    "WorkOrderStep": [
        "WorkOrderStepId",
        "WorkOrderId",
        "RoutingStepId",
        "Sequence",
        "StepName",
        "OperationCode",
        "Status",
        "WorkcenterId",
        "OperatorId",
        "PlannedDurationMins",
        "ActualDurationMins",
        "PlannedQty",
        "CompletedQty",
        "ProgressPercent",
        "InstructionUrl",
        "StartedAt",
        "CompletedAt",
        "CustomerId",
        "CreatedBy",
        "CreatedDate",
        "UpdatedBy",
        "UpdatedDate"
    ],
    "WorkStepActions": [
        "WorkStepId",
        "ActionName",
        "RequestId",
        "ActionId",
        "NotificationTemplate",
        "TargetStepId",
        "NextWorkstepId",
        "SendNotification",
        "CloseWorkflow",
        "WarningMessage",
        "CommentRequired",
        "AttachmentRequired",
        "AttachmentMandatory"
    ],
    "WorkStepAgents": [
        "RequestId",
        "WorkstepId",
        "AgentGroupName",
        "Id",
        "SendNotification",
        "SLADays"
    ],
    "Worksteps": [
        "RequestId",
        "WorkstepId",
        "Id",
        "ParentRequestId",
        "WorkstepName",
        "WorkStepDescription",
        "InitiationDate",
        "FormUrl",
        "InitiatorId",
        "InitiatorName",
        "IsActive",
        "IsComplete",
        "Remarks",
        "ActionDate",
        "ActionBy",
        "ActionByName",
        "Action",
        "CurrentStatus",
        "CurrentStatusName",
        "SLADays",
        "AttachmentIds",
        "CurrentAction"
    ]
}

# ---------------------------------------------------------------------------
# LangGraph State
# ---------------------------------------------------------------------------
class AgentState(TypedDict):
    prompt: str
    intent_output: dict
    schema_context: dict
    sql_query: str
    query_results: dict
    full_df: Optional[list]
    processed_data: dict
    insights_output: dict
    charts_visuals: list
    html_content: str
    pdf_path: str
    error: Optional[str]
    retry_count: int
    requires_hitl: bool
    is_approved: bool
    execution_steps: list

# ---------------------------------------------------------------------------
# JSON serializer helper (Decimal / datetime / NaN / numpy types)
# ---------------------------------------------------------------------------
def make_json_serializable(obj):
    import math
    # Handle numpy types if numpy is installed
    try:
        import numpy as np
        if isinstance(obj, (np.integer,)):
            return int(obj)
        if isinstance(obj, (np.floating,)):
            v = float(obj)
            return None if (math.isnan(v) or math.isinf(v)) else v
        if isinstance(obj, np.ndarray):
            return make_json_serializable(obj.tolist())
        if isinstance(obj, np.bool_):
            return bool(obj)
    except ImportError:
        pass
    if isinstance(obj, list):
        return [make_json_serializable(i) for i in obj]
    if isinstance(obj, dict):
        return {k: make_json_serializable(v) for k, v in obj.items()}
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    return obj

# ---------------------------------------------------------------------------
# Node 1 — Intent Understanding
# ---------------------------------------------------------------------------
async def intent_understanding_node(state: AgentState) -> dict:
    logger.info("-> [Node 1] Parsing user request intent...")
    prompt = state["prompt"]

    sys_prompt = "Analyze the factory metrics query. If the user is strictly saying a casual greeting (like hi, hello, how are you), return {'is_greeting': true}. If the user is asking for ANY manufacturing data (e.g. machine data, work orders), DO NOT return is_greeting. Instead, return JSON keys: 'report_type', 'metrics', 'filters'."
    resp = await execute_completion(
        model=PRIMARY_MODEL,
        messages=[
            {"role": "system", "content": sys_prompt},
            {"role": "user", "content": prompt}
        ]
    )
    try:
        raw = resp["text"].replace("```json", "").replace("```", "").strip()
        out = json.loads(raw)
    except Exception:
        # Check simple heuristic before defaulting (use word boundaries to avoid matching 'hi' in 'machine')
        prompt_lower = prompt.strip().lower()
        import re
        if re.search(r'\b(hi|hello|hey|how are you|who are you|what\'s up|good morning|good afternoon)\b', prompt_lower):
            out = {"is_greeting": True}
        else:
            out = {"report_type": "Production Summary", "metrics": ["Qty"], "filters": {}}

    return {
        "intent_output": out,
        "execution_steps": state.get("execution_steps", []) + ["Node: intent"]
    }

# ---------------------------------------------------------------------------
# Node 2 — Schema Context Retrieval
# ---------------------------------------------------------------------------
async def schema_context_retrieval_node(state: AgentState) -> dict:
    logger.info("-> [Node 2] Fetching allowed relational schema metadata...")
    return {
        "schema_context": {"tables": list(MES_CATALOG.keys()), "columns": MES_CATALOG},
        "execution_steps": state.get("execution_steps", []) + ["Node: schema"]
    }

# ---------------------------------------------------------------------------
# Node 3 — SQL Generation
# ---------------------------------------------------------------------------
async def sql_generation_node(state: AgentState) -> dict:
    logger.info("-> [Node 3] Generating read-only SQL string...")
    intent = state["intent_output"]
    schema = state["schema_context"]
    err = state.get("error", "")

    sys_prompt = f"""You are a SQL query generator for Microsoft SQL Server.
Based on this database schema: {json.dumps(schema)}

Your job is to generate ONLY the SQL required to answer the user's question.

RULES:
1. Never query every allowed table.
2. Use only tables relevant to the user request.
3. You may generate multiple SELECT statements if multiple distinct types of data are needed.
4. Separate multiple SELECT statements using ';;;'.
5. Never generate INSERT, UPDATE, DELETE, DROP, ALTER, CREATE or EXEC.
6. Never return markdown.
7. Never return explanations.
8. Never return comments.
9. Never use tables outside the provided schema.
10. If the request cannot be answered from the available schema, return:
    SELECT 'No relevant data' AS Result
11. Always use SQL Server syntax.
12. Prefer TOP 100 unless the user explicitly requests another limit."""

    user_msg = f"Intent: {json.dumps(intent)}."
    if err:
        user_msg += f" Fix this error from your last attempt: {err}"

    resp = await execute_completion(
        model=PRIMARY_MODEL,
        messages=[
            {"role": "system", "content": sys_prompt},
            {"role": "user", "content": user_msg}
        ]
    )
    query = resp["text"].replace("```sql", "").replace("```", "").strip()
    logger.info(f"   [Generated SQL]\n{query[:1200]}")

    # Security Block — reject any non-SELECT statements
    if any(hack in query.upper() for hack in ["DROP", "DELETE", "UPDATE", "INSERT", "ALTER"]):
        return {
            "sql_query": "",
            "error": "Security Exception: Non-SELECT clause detected.",
            "execution_steps": state.get("execution_steps", []) + ["Node: sql_gen (BLOCKED)"]
        }

    return {
        "sql_query": query,
        "error": None,
        "execution_steps": state.get("execution_steps", []) + ["Node: sql_gen"]
    }

# ---------------------------------------------------------------------------
# Node 4 — SQL Execution (multi-table ;;; split)
# ---------------------------------------------------------------------------
async def sql_execution_node(state: AgentState) -> dict:
    logger.info("-> [Node 4] Executing validated query inside target data source...")
    query_text = state["sql_query"]
    current_retry = state.get("retry_count", 0)

    if not query_text:
        return {
            "error": "No SQL query to execute.",
            "retry_count": current_retry + 1,
            "execution_steps": state.get("execution_steps", []) + ["Node: sql_exec (NO QUERY)"]
        }

    all_results = []
    total_rows = 0
    last_error = None

    def _run_queries():
        """Runs the query synchronously — called via executor."""
        nonlocal total_rows, last_error
        engine = sync_mes_engine  # may be None if SQL Server not connected

        queries = [q.strip() for q in query_text.split(";;;") if q.strip()]
        for exec_query in queries:
            try:
                if engine is not None:
                    df = pd.read_sql_query(exec_query, engine)
                else:
                    # SQLite fallback — convert TOP N → LIMIT N
                    from app.db import DATABASE_URL
                    from sqlalchemy import create_engine as _ce
                    _lite = _ce(DATABASE_URL.replace("+aiosqlite", ""))
                    sqlite_q = re.sub(r"SELECT\s+TOP\s+\d+", "SELECT", exec_query, flags=re.IGNORECASE)
                    m = re.search(r"TOP\s+(\d+)", exec_query, re.IGNORECASE)
                    limit = m.group(1) if m else "100"
                    sqlite_q = sqlite_q.rstrip(";") + f" LIMIT {limit}"
                    df = pd.read_sql_query(sqlite_q, _lite)
                rows = len(df)
                nonlocal total_rows
                total_rows += rows
                all_results.append({"table": f"Query_{len(all_results)+1}", "df": df, "rows": rows})
                logger.info(f"   [SQL Result] {rows} records.")
            except Exception as e:
                last_error = str(e)
                logger.error(f"   [SQL EXECUTION ERROR] {e}")
                logger.error(f"   [SQL THAT FAILED]\n{exec_query}")

    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _run_queries)

    if all_results:
        logger.info(f"   [SQL Total] {total_rows} records.")
        return {
            "full_df": all_results,
            "query_results": {"row_count": total_rows, "status": "Success"},
            "error": None,
            "execution_steps": state.get("execution_steps", []) + ["Node: sql_exec"]
        }
    else:
        return {
            "error": last_error or "All queries failed",
            "retry_count": current_retry + 1,
            "execution_steps": state.get("execution_steps", []) + ["Node: sql_exec (FAILED)"]
        }

# ---------------------------------------------------------------------------
# Node 5 — Data Profiling & Aggregation
# ---------------------------------------------------------------------------
async def data_profiling_aggregation_node(state: AgentState) -> dict:
    logger.info("-> [Node 5] Executing profiling rules and cleaning values...")
    results = state.get("full_df")

    if results is None:
        return {"processed_data": {"cleaned_summary": "{}", "row_count": 0},
                "execution_steps": state.get("execution_steps", []) + ["Node: profiling"]}

    if isinstance(results, list):
        sections = []
        total_rows = 0
        for item in results:
            table_name = item.get("table", "Unknown")
            df = item.get("df")
            if df is not None and not df.empty:
                csv_str = df.head(100).to_csv(index=False)
                sections.append(f"=== TABLE: {table_name} ({len(df)} rows) ===\n{csv_str}")
                total_rows += len(df)
        combined = "\n\n".join(sections) if sections else "{}"
        return {
            "processed_data": {"cleaned_summary": combined, "row_count": total_rows},
            "execution_steps": state.get("execution_steps", []) + ["Node: profiling"]
        }

    if isinstance(results, pd.DataFrame) and not results.empty:
        return {
            "processed_data": {"cleaned_summary": results.head(100).to_csv(index=False), "row_count": len(results)},
            "execution_steps": state.get("execution_steps", []) + ["Node: profiling"]
        }

    return {"processed_data": {"cleaned_summary": "{}", "row_count": 0},
            "execution_steps": state.get("execution_steps", []) + ["Node: profiling"]}

# ---------------------------------------------------------------------------
# Node 6 — Analysis & Insights (JSON for PDF)
# ---------------------------------------------------------------------------
async def analysis_insights_node(state: AgentState) -> dict:
    logger.info("-> [Node 6] Generating detailed JSON for PDF report...")
    proc = state.get("processed_data") or {}
    raw_data = proc.get("cleaned_summary", "")
    prompt = state.get("prompt", "")

    sys_prompt = """You are a manufacturing data analyst.
You are given REAL production data from multiple database tables, each labeled with === TABLE: TableName ===.

Based on this REAL data, provide a detailed JSON response for a PDF report.
The JSON MUST follow this exact format with all keys present:
{
  "executive_summary": "3-4 sentence summary using ONLY real numbers from the data provided.",
  "production_analysis": "Analysis of actual work order records from the data.",
  "production_table": [
    {"day": "Work Order or Label", "target": 1000, "actual": 1000, "status": "On Track"}
  ],
  "oee_overview": "Analysis of machine utilization from CapacityAnalysis data.",
  "oee_table": [
    {"line": "Machine ID or Name", "oee": 85.0, "status": "Optimal"}
  ],
  "shift_analysis": "Analysis of shift-wise production from WeighingMachine data.",
  "shift_table": [
    {"shift": "Shift Name", "output": 4700, "rejections": 50, "defect_rate": "1.1%"}
  ],
  "scrap_drivers": "Analysis of scrap causes from Scrap table data.",
  "scrap_distribution": [
    {"cause": "Material or Category", "percentage": 42.0}
  ],
  "corrective_actions": [
    {"action": "Specific action based on real findings", "target": "Area", "owner": "Department", "deadline": "Date"}
  ]
}

CRITICAL RULES:
- Use ONLY the actual numbers from the provided data. Do NOT fabricate, simulate, or extrapolate ANY values.
- For production_table: Map WorkOrder PlannedQty as target, CompletedQty as actual. Use WorkOrderNumber as the day/label.
- For oee_table: Use CapacityAnalysis UtilizationPercent as OEE. Use MachineId as line name. If no CapacityAnalysis data exists, use empty array [].
- For shift_table: Use WeighingMachine data. Sum FGQuantity as output, RejectedQuantity as rejections per ShiftName. Calculate defect_rate from real numbers. If no WeighingMachine data, use [].
- For scrap_distribution: Calculate percentage from actual Scrap quantities. If no Scrap data, use [].
- Mark status as 'Optimal' if utilization >= 85%, 'On Track' if actual >= target, 'Below Target' otherwise.
- corrective_actions should be based on real issues found in the data.
Return ONLY valid JSON without markdown formatting blocks."""

    user_content = f"User Request: {prompt}\n\nReal Database Data:\n{raw_data}"
    resp = await execute_completion(
        model=PRIMARY_MODEL,
        messages=[
            {"role": "system", "content": sys_prompt},
            {"role": "user", "content": user_content}
        ]
    )

    clean_text = resp["text"].replace("```json", "").replace("```", "").strip()
    try:
        out = json.loads(clean_text)
    except Exception:
        out = {}

    return {
        "insights_output": out,
        "execution_steps": state.get("execution_steps", []) + ["Node: insights"]
    }

# ---------------------------------------------------------------------------
# Node 7 — Chart Generation (saves to reports/, deleted after PDF compilation)
# ---------------------------------------------------------------------------
def _generate_charts_sync(data: dict) -> list:
    """Synchronous chart generation — runs in thread executor."""
    os.makedirs("reports", exist_ok=True)
    paths = []
    plt.style.use("bmh")

    try:
        # Chart 1: Weekly Production Trends (Line Chart)
        if data.get("production_table"):
            fig, ax = plt.subplots(figsize=(5, 3))
            days = [item["day"] for item in data["production_table"]]
            targets = [item["target"] for item in data["production_table"]]
            actuals = [item["actual"] for item in data["production_table"]]

            ax.plot(days, targets, marker="", linestyle="--", color="#718096", label="Target Production")
            ax.plot(days, actuals, marker="o", color="#1A365D", label="Actual Production")
            ax.set_ylabel("Quantity (Units)", fontsize=8)
            ax.set_title("Weekly Production Trend (Units)", fontsize=10, fontweight="bold")
            ax.legend(fontsize=7, loc="lower right")
            plt.tight_layout()
            path1 = os.path.abspath(f"reports/chart1_{uuid.uuid4().hex[:8]}.png")
            plt.savefig(path1, dpi=300)
            plt.close(fig)
            paths.append(path1)
        else:
            paths.append("")

        # Chart 2: Machine OEE Bar Chart
        if data.get("oee_table"):
            fig, ax = plt.subplots(figsize=(5, 3))
            lines = [str(item["line"]) for item in data["oee_table"]]
            oees = [float(item["oee"]) for item in data["oee_table"]]

            bars = ax.bar(lines, oees, width=0.5, color="#2B6CB0")
            ax.axhline(y=85, color="#E53E3E", linestyle="--", label="Target OEE (85%)")
            ax.set_ylim(0, 110)
            ax.set_ylabel("OEE (%)", fontsize=8)
            ax.set_title("Overall Equipment Effectiveness (OEE) by Line", fontsize=10, fontweight="bold")
            ax.legend(fontsize=7, loc="lower right")
            for bar in bars:
                yval = bar.get_height()
                ax.text(bar.get_x() + bar.get_width() / 2, yval + 1, f"{yval}%", ha="center", va="bottom", fontsize=7)
            plt.tight_layout()
            path2 = os.path.abspath(f"reports/chart2_{uuid.uuid4().hex[:8]}.png")
            plt.savefig(path2, dpi=300)
            plt.close(fig)
            paths.append(path2)
        else:
            paths.append("")

        # Chart 3: Rejection vs Production (Dual-axis Bar)
        if data.get("shift_table"):
            tbl = data["shift_table"]
            shifts = []
            for item in tbl:
                parts = str(item["shift"]).split()
                shifts.append(" ".join(parts[:2]) if len(parts) >= 2 else str(item["shift"]))
            outputs = [float(item["output"]) for item in tbl]
            rejections = [float(item["rejections"]) for item in tbl]

            fig, ax1 = plt.subplots(figsize=(5, 3))
            ax2 = ax1.twinx()
            width = 0.35
            x = range(len(shifts))

            ax1.bar([i - width / 2 for i in x], outputs, width=width, color="#2B6CB0", label="Total Production")
            ax2.bar([i + width / 2 for i in x], rejections, width=width, color="#E53E3E", label="Rejections")
            ax1.set_ylabel("Total Production (Units)", fontsize=8, color="#2B6CB0")
            ax2.set_ylabel("Rejections (Units)", fontsize=8, color="#E53E3E")
            ax1.set_xticks(list(x))
            ax1.set_xticklabels(shifts, fontsize=8)
            ax1.set_title("Production Volume vs. Rejections by Shift", fontsize=10, fontweight="bold")
            lines1, labels1 = ax1.get_legend_handles_labels()
            lines2, labels2 = ax2.get_legend_handles_labels()
            ax1.legend(lines1 + lines2, labels1 + labels2, fontsize=7, loc="upper left")
            plt.tight_layout()
            path3 = os.path.abspath(f"reports/chart3_{uuid.uuid4().hex[:8]}.png")
            plt.savefig(path3, dpi=300)
            plt.close(fig)
            paths.append(path3)
        else:
            paths.append("")

        # Chart 4: Scrap Donut
        if data.get("scrap_distribution"):
            fig, ax = plt.subplots(figsize=(4, 4))
            labels = [item["cause"] for item in data["scrap_distribution"]]
            sizes = [float(item["percentage"]) for item in data["scrap_distribution"]]

            wedges, texts, autotexts = ax.pie(
                sizes, labels=labels, autopct="%1.1f%%", startangle=90,
                colors=["#1A365D", "#2B6CB0", "#63B3ED", "#E2E8F0"],
                textprops=dict(color="w", fontsize=7)
            )
            for t in texts:
                t.set_color("black")
                t.set_fontsize(7)
            ax.add_artist(plt.Circle((0, 0), 0.65, fc="white"))
            ax.set_title("Scrap Distribution by Cause (%)", fontsize=9, fontweight="bold")
            plt.tight_layout()
            path4 = os.path.abspath(f"reports/chart4_{uuid.uuid4().hex[:8]}.png")
            plt.savefig(path4, dpi=300)
            plt.close(fig)
            paths.append(path4)
        else:
            paths.append("")

    except Exception as e:
        logger.error(f"Chart generation error: {e}")

    return paths


async def chart_generation_node(state: AgentState) -> dict:
    logger.info("-> [Node 7] Producing analytics visual assets...")
    data = state.get("insights_output", {})
    loop = asyncio.get_event_loop()
    paths = await loop.run_in_executor(None, _generate_charts_sync, data)
    return {
        "charts_visuals": paths,
        "execution_steps": state.get("execution_steps", []) + ["Node: charts"]
    }

# ---------------------------------------------------------------------------
# Node 8 — HTML (passthrough)
# ---------------------------------------------------------------------------
async def html_report_generation_node(state: AgentState) -> dict:
    return {
        "html_content": "{}",
        "execution_steps": state.get("execution_steps", []) + ["Node: html"]
    }

# ---------------------------------------------------------------------------
# Node 9 — PDF Compilation (ReportLab)
# ---------------------------------------------------------------------------
def _compile_pdf_sync(data: dict, charts: list) -> str:
    """Synchronous PDF compilation — runs in thread executor."""
    os.makedirs("reports", exist_ok=True)
    pdf_filename = f"reports/premium_report_{uuid.uuid4().hex[:8]}.pdf"
    pdf_path = os.path.abspath(pdf_filename)

    try:
        doc = SimpleDocTemplate(
            pdf_path, pagesize=letter,
            leftMargin=36, rightMargin=36, topMargin=36, bottomMargin=36
        )
        story = []
        styles = getSampleStyleSheet()

        title_style    = ParagraphStyle("DocTitle", parent=styles["Heading1"], fontSize=16, textColor=colors.HexColor("#1A365D"), spaceAfter=2)
        subtitle_style = ParagraphStyle("DocSub", parent=styles["Normal"], fontSize=9, textColor=colors.HexColor("#4A5568"), spaceAfter=15)
        h2_style       = ParagraphStyle("H2", fontName="Helvetica-Bold", fontSize=12, textColor=colors.HexColor("#1A365D"), spaceBefore=15, spaceAfter=8)
        body_style     = ParagraphStyle("BodyText", fontName="Helvetica", fontSize=9, leading=14, textColor=colors.HexColor("#2D3748"))
        th_style       = ParagraphStyle("TH", fontName="Helvetica-Bold", fontSize=9, textColor=colors.white)
        td_style       = ParagraphStyle("TD", fontName="Helvetica", fontSize=9, textColor=colors.HexColor("#2D3748"))

        def make_table(data_list, headers, widths, color_list=None):
            if not color_list:
                color_list = ["#2B6CB0", "#E2E8F0", "#F7FAFC"]
            tdata = [[Paragraph(h, th_style) for h in headers]]
            for row in data_list:
                tdata.append([Paragraph(str(cell), td_style) for cell in row])
            t = Table(tdata, colWidths=widths)
            t.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(color_list[0])),
                ("TEXTCOLOR",  (0, 0), (-1, 0), colors.white),
                ("ALIGN",      (0, 0), (-1, -1), "LEFT"),
                ("VALIGN",     (0, 0), (-1, -1), "MIDDLE"),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 8),
                ("TOPPADDING",    (0, 0), (-1, 0), 8),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor(color_list[2]), colors.white]),
                ("LINEBELOW",  (0, 1), (-1, -1), 0.5, colors.HexColor(color_list[1]))
            ]))
            return t

        # Header
        story.append(Paragraph("PRODUCTION PERFORMANCE &amp; QUALITY REPORT", title_style))
        story.append(Paragraph(
            "<b>Facility:</b> Main Manufacturing Plant &nbsp;&nbsp;&nbsp;&nbsp; <b>Reporting Period:</b> Weekly Summary",
            subtitle_style
        ))

        # Executive Summary
        story.append(Paragraph("<b>Executive Summary:</b>", ParagraphStyle("H3", fontName="Helvetica-Bold", fontSize=10, textColor=colors.HexColor("#1A365D"))))
        story.append(Spacer(1, 5))
        story.append(Paragraph(data.get("executive_summary", "No summary available."), body_style))
        story.append(Spacer(1, 15))

        # Section 1: Weekly Production Trends
        story.append(Paragraph("1. Weekly Production Trends", h2_style))
        t1_data = [[r.get("day", ""), r.get("target", ""), r.get("actual", ""), r.get("status", "")] for r in data.get("production_table", [])]
        t1 = make_table(t1_data, ["Day", "Target", "Actual", "Status"], [80, 60, 60, 80])

        chart1 = (RLImage(charts[0], width=250, height=150)
                  if len(charts) > 0 and charts[0] and os.path.exists(charts[0])
                  else Paragraph("[Chart Missing]", body_style))
        right_col1 = [Paragraph("<b>Production Analysis:</b>", body_style), Spacer(1, 5),
                      Paragraph(data.get("production_analysis", ""), body_style), Spacer(1, 10), t1]
        layout1 = Table([[chart1, right_col1]], colWidths=[260, 280])
        layout1.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
        story.append(layout1)

        # Section 2: Machine OEE
        story.append(Paragraph("2. Machine Performance (OEE Breakdown)", h2_style))
        t2_data = [[r.get("line", ""), f"{r.get('oee', '')}%", r.get("status", "")] for r in data.get("oee_table", [])]
        t2 = make_table(t2_data, ["Line", "OEE Score", "Status"], [80, 80, 80])

        chart2 = (RLImage(charts[1], width=260, height=150)
                  if len(charts) > 1 and charts[1] and os.path.exists(charts[1])
                  else Paragraph("[Chart Missing]", body_style))
        left_col2 = [Paragraph("<b>OEE Overview:</b>", body_style), Spacer(1, 5),
                     Paragraph(data.get("oee_overview", ""), body_style), Spacer(1, 10), t2]
        layout2 = Table([[left_col2, chart2]], colWidths=[260, 280])
        layout2.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
        story.append(layout2)
        story.append(Spacer(1, 20))

        # Section 3: Rejection vs Production
        story.append(Paragraph("3. Rejection vs. Production Volume by Shift", h2_style))
        t3_data = [[r.get("shift", ""), r.get("output", ""), r.get("rejections", ""), str(r.get("defect_rate", ""))] for r in data.get("shift_table", [])]
        t3 = make_table(t3_data, ["Shift", "Output", "Rejections", "Defect Rate"], [100, 70, 70, 80])

        chart3 = (RLImage(charts[2], width=250, height=150)
                  if len(charts) > 2 and charts[2] and os.path.exists(charts[2])
                  else Paragraph("[Chart Missing]", body_style))
        right_col3 = [Paragraph("<b>Shift Efficiency Analysis:</b>", body_style), Spacer(1, 5),
                      Paragraph(data.get("shift_analysis", ""), body_style)]
        layout3 = Table([[chart3, right_col3]], colWidths=[260, 280])
        layout3.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
        story.append(layout3)
        story.append(Spacer(1, 10))
        story.append(t3)

        # Section 4: Scrap Analysis
        story.append(Paragraph("4. Scrap Analysis &amp; Waste Distribution", h2_style))
        chart4 = (RLImage(charts[3], width=200, height=200)
                  if len(charts) > 3 and charts[3] and os.path.exists(charts[3])
                  else Paragraph("[Chart Missing]", body_style))
        left_col4 = [Paragraph("<b>Key Scrap Drivers:</b>", body_style), Spacer(1, 5),
                     Paragraph(data.get("scrap_drivers", ""), body_style)]
        layout4 = Table([[left_col4, chart4]], colWidths=[280, 260])
        layout4.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE")]))
        story.append(layout4)

        # Section 5: Corrective Action Plan
        story.append(Paragraph("5. Corrective Action Plan", h2_style))
        t5_data = [[r.get("action", ""), r.get("target", ""), r.get("owner", ""), r.get("deadline", "")] for r in data.get("corrective_actions", [])]
        t5 = make_table(t5_data, ["Action Item", "Target Area", "Owner", "Deadline"], [200, 100, 120, 100])
        story.append(t5)

        doc.build(story)
        logger.info(f"-> Production PDF successfully written: {pdf_path}")

    except Exception as e:
        logger.error(f"PDF compilation failed: {e}")

    return pdf_path


async def pdf_compilation_node(state: AgentState) -> dict:
    logger.info("-> [Node 9] Initiating ReportLab engine for advanced layout mapping...")
    data = state.get("insights_output", {})
    charts = state.get("charts_visuals", [])

    loop = asyncio.get_event_loop()
    pdf_path = await loop.run_in_executor(None, _compile_pdf_sync, data, charts)

    # Delete chart temp files after PDF is compiled
    for path in charts:
        if path and os.path.exists(path):
            try:
                os.remove(path)
            except Exception:
                pass

    return {
        "pdf_path": pdf_path,
        "execution_steps": state.get("execution_steps", []) + ["Node: pdf"]
    }

# ---------------------------------------------------------------------------
# Routing & Fallback
# ---------------------------------------------------------------------------
def check_intent_route(state: AgentState) -> str:
    intent = state.get("intent_output", {})
    if intent.get("is_greeting") or intent.get("is_greeting") == "true":
        return "greeting"
    return "schema"

async def greeting_response_node(state: AgentState) -> dict:
    logger.info("-> [Greeting Node] User sent a casual greeting.")
    return {
        "insights_output": {},
        "error": "Hello! I am Deva, your manufacturing agent. How can I assist with your operations today?",
        "execution_steps": state.get("execution_steps", []) + ["Node: greeting (short-circuit)"]
    }

def check_sql_validity_route(state: AgentState) -> str:
    if state.get("error"):
        if state.get("retry_count", 0) >= 3:
            logger.info("   -> [Route Decision] Max iterations hit. Triggering Fallback Node.")
            return "fallback"
        logger.info("   -> [Route Decision] Routing back to SQL correction...")
        return "retry"
    return "execute_success"

async def fallback_response_node(state: AgentState) -> dict:
    logger.info("-> [Fallback Node] Compiling emergency report configuration...")
    return {
        "error": "Critical execution boundary failure. Report generated via empty state constraints.",
        "execution_steps": state.get("execution_steps", []) + ["Node: fallback"]
    }

# ---------------------------------------------------------------------------
# Build LangGraph
# ---------------------------------------------------------------------------
workflow = StateGraph(AgentState)

workflow.add_node("intent",    intent_understanding_node)
workflow.add_node("schema",    schema_context_retrieval_node)
workflow.add_node("sql_gen",   sql_generation_node)
workflow.add_node("sql_exec",  sql_execution_node)
workflow.add_node("profiling", data_profiling_aggregation_node)
workflow.add_node("insights",  analysis_insights_node)
workflow.add_node("charts",    chart_generation_node)
workflow.add_node("html",      html_report_generation_node)
workflow.add_node("pdf",       pdf_compilation_node)
workflow.add_node("fallback",  fallback_response_node)
workflow.add_node("greeting",  greeting_response_node)

workflow.add_edge(START,       "intent")
workflow.add_conditional_edges(
    "intent",
    check_intent_route,
    {"greeting": "greeting", "schema": "schema"}
)
workflow.add_edge("schema",    "sql_gen")
workflow.add_edge("sql_gen",   "sql_exec")

workflow.add_conditional_edges(
    "sql_exec",
    check_sql_validity_route,
    {"retry": "sql_gen", "fallback": "fallback", "execute_success": "profiling"}
)

workflow.add_edge("profiling", "insights")
workflow.add_edge("insights",  "charts")
workflow.add_edge("charts",    "html")
workflow.add_edge("html",      "pdf")
workflow.add_edge("pdf",       END)
workflow.add_edge("fallback",  END)
workflow.add_edge("greeting",  END)

app = workflow.compile()

# ---------------------------------------------------------------------------
# Insights → Markdown (for dashboard display)
# ---------------------------------------------------------------------------
def compile_insights_to_markdown(data: dict) -> str:
    if not data:
        return ""
    md = []

    if data.get("executive_summary"):
        md.append("## Executive Summary")
        md.append(data["executive_summary"])
        md.append("")

    if data.get("production_analysis"):
        md.append("## Production Analysis")
        md.append(data["production_analysis"])
        md.append("")

    if data.get("production_table"):
        md.append("### Work Order Production Table")
        md.append("| Work Order | Target | Actual | Status |")
        md.append("|---|---|---|---|")
        for r in data["production_table"]:
            md.append(f"| {r.get('day','')} | {r.get('target','')} | {r.get('actual','')} | {r.get('status','')} |")
        md.append("")

    if data.get("oee_overview"):
        md.append("## OEE Overview")
        md.append(data["oee_overview"])
        md.append("")

    if data.get("oee_table"):
        md.append("### Machine OEE Breakdown")
        md.append("| Line | OEE | Status |")
        md.append("|---|---|---|")
        for r in data["oee_table"]:
            md.append(f"| {r.get('line','')} | {r.get('oee','')}% | {r.get('status','')} |")
        md.append("")

    if data.get("shift_analysis"):
        md.append("## Shift Analysis")
        md.append(data["shift_analysis"])
        md.append("")

    if data.get("shift_table"):
        md.append("### Shift-wise Production")
        md.append("| Shift | Output | Rejections | Defect Rate |")
        md.append("|---|---|---|---|")
        for r in data["shift_table"]:
            md.append(f"| {r.get('shift','')} | {r.get('output','')} | {r.get('rejections','')} | {r.get('defect_rate','')} |")
        md.append("")

    if data.get("scrap_drivers"):
        md.append("## Scrap Analysis")
        md.append(data["scrap_drivers"])
        md.append("")

    if data.get("scrap_distribution"):
        md.append("### Scrap Distribution")
        md.append("| Cause | Percentage |")
        md.append("|---|---|")
        for r in data["scrap_distribution"]:
            md.append(f"| {r.get('cause','')} | {r.get('percentage','')}% |")
        md.append("")

    if data.get("corrective_actions"):
        md.append("## Corrective Action Plan")
        md.append("| Action | Target | Owner | Deadline |")
        md.append("|---|---|---|---|")
        for r in data["corrective_actions"]:
            md.append(f"| {r.get('action','')} | {r.get('target','')} | {r.get('owner','')} | {r.get('deadline','')} |")
        md.append("")

    return "\n".join(md)


# ---------------------------------------------------------------------------
# Primary Entry Point
# ---------------------------------------------------------------------------
async def run_agent_workflow(query: str, is_approved: bool = False) -> dict:
    initial_state = {
        "prompt": query,
        "intent_output": {},
        "schema_context": {},
        "sql_query": "",
        "query_results": {},
        "full_df": None,
        "processed_data": {},
        "insights_output": {},
        "charts_visuals": [],
        "html_content": "",
        "pdf_path": "",
        "error": None,
        "retry_count": 0,
        "requires_hitl": False,
        "is_approved": is_approved,
        "execution_steps": []
    }

    final_state = await app.ainvoke(initial_state)

    insights_md = compile_insights_to_markdown(final_state.get("insights_output", {}))
    if not insights_md:
        insights_md = final_state.get("error") or "No insights compiled."

    serialized_sql_result = []
    if final_state.get("full_df"):
        for item in final_state["full_df"]:
            df_val = item.get("df")
            if df_val is not None:
                serialized_sql_result.append({
                    "table": item["table"],
                    "rows": item["rows"],
                    "data": make_json_serializable(df_val.to_dict(orient="records"))
                })

    pdf_filename = os.path.basename(final_state.get("pdf_path", ""))
    pdf_url = f"http://localhost:8000/reports/{pdf_filename}" if pdf_filename else ""

    return {
        "sql_query": final_state.get("sql_query", ""),
        "sql_result": serialized_sql_result,
        "insights": insights_md,
        "execution_steps": final_state.get("execution_steps", []),
        "pdf_url": pdf_url,
        "requires_hitl": final_state.get("requires_hitl", False),
        "is_approved": final_state.get("is_approved", False),
        "error_message": final_state.get("error") or ""
    }
