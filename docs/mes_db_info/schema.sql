USE [mes_new]
GO
/****** Object:  Table [dbo].[Actions]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Actions](
	[Id] [int] NOT NULL,
	[ActionName] [nvarchar](50) NOT NULL,
	[Icon] [nvarchar](50) NULL,
	[CssClass] [nvarchar](50) NULL,
 CONSTRAINT [PK_Actions] PRIMARY KEY CLUSTERED 
(
	[Id] ASC,
	[ActionName] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[AlertMaster]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AlertMaster](
	[AlertId] [int] IDENTITY(1,1) NOT NULL,
	[AlertType] [nvarchar](50) NOT NULL,
	[Severity] [nvarchar](20) NOT NULL,
	[Title] [nvarchar](200) NOT NULL,
	[Message] [nvarchar](max) NOT NULL,
	[Source] [nvarchar](50) NULL,
	[SourceId] [int] NULL,
	[WorkOrderId] [int] NULL,
	[MachineId] [int] NULL,
	[IsAcknowledged] [bit] NOT NULL,
	[AcknowledgedBy] [nvarchar](100) NULL,
	[AcknowledgedAt] [datetime2](7) NULL,
	[IsResolved] [bit] NOT NULL,
	[ResolvedBy] [nvarchar](100) NULL,
	[ResolvedAt] [datetime2](7) NULL,
	[ResolutionNotes] [nvarchar](max) NULL,
	[CreatedDate] [datetime2](7) NOT NULL,
	[CustomerId] [int] NOT NULL,
	[CreatedBy] [nvarchar](100) NULL,
	[UpdatedDate] [datetime2](7) NULL,
	[UpdatedBy] [nvarchar](50) NULL,
PRIMARY KEY CLUSTERED 
(
	[AlertId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[AlternateUnit]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AlternateUnit](
	[AlternateUnitId] [int] IDENTITY(1,1) NOT NULL,
	[AlternateUnitName] [nvarchar](50) NOT NULL,
	[CompanyId] [int] NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[CreatedOn] [datetime] NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[UpdatedOn] [datetime] NULL,
 CONSTRAINT [PK_AlternateUnit_1] PRIMARY KEY CLUSTERED 
(
	[AlternateUnitId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[AssetType]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AssetType](
	[AssetTypeId] [int] IDENTITY(1,1) NOT NULL,
	[AssetTypeName] [nvarchar](50) NOT NULL,
	[CompanyId] [int] NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[CreatedOn] [datetime] NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[UpdatedOn] [datetime] NULL,
 CONSTRAINT [PK_AssetType_1] PRIMARY KEY CLUSTERED 
(
	[AssetTypeId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[AssetTypeTesting]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AssetTypeTesting](
	[AssetTypeId] [int] IDENTITY(1,1) NOT NULL,
	[AssetTypeName] [nvarchar](50) NOT NULL,
	[CompanyId] [int] NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[CreatedOn] [datetime] NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[UpdatedOn] [datetime] NULL,
 CONSTRAINT [PK_AssetTypetesting_1] PRIMARY KEY CLUSTERED 
(
	[AssetTypeId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[BinMaster]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[BinMaster](
	[BinId] [int] IDENTITY(1,1) NOT NULL,
	[BinName] [nvarchar](50) NULL,
	[BinCode] [nvarchar](50) NULL,
	[MachineId] [int] NULL,
	[Capacity] [nvarchar](50) NULL,
	[IsActive] [bit] NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[CreatedOn] [datetime] NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[UpdatedOn] [datetime] NULL,
	[CompanyId] [int] NULL,
	[QRCodeUrl] [nvarchar](100) NULL,
	[MachineName] [nvarchar](50) NULL,
 CONSTRAINT [PK_Bin] PRIMARY KEY CLUSTERED 
(
	[BinId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[BOMLine]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[BOMLine](
	[BOMLineId] [int] IDENTITY(1,1) NOT NULL,
	[BOMId] [int] NOT NULL,
	[ComponentId] [int] NOT NULL,
	[Quantity] [decimal](18, 4) NOT NULL,
	[UOM] [nvarchar](20) NULL,
	[Sequence] [int] NULL,
	[ScrapPercent] [decimal](5, 2) NULL,
	[IsActive] [bit] NOT NULL,
	[CustomerId] [int] NOT NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[CreatedDate] [datetime2](7) NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[UpdatedDate] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[BOMLineId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[BOMMaster]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[BOMMaster](
	[BOMId] [int] IDENTITY(1,1) NOT NULL,
	[ProductId] [int] NOT NULL,
	[BOMVersion] [nvarchar](20) NOT NULL,
	[EffectiveFrom] [date] NULL,
	[EffectiveTo] [date] NULL,
	[Status] [nvarchar](20) NULL,
	[Description] [nvarchar](500) NULL,
	[IsActive] [bit] NOT NULL,
	[CustomerId] [int] NOT NULL,
	[CreatedBy] [nvarchar](100) NULL,
	[CreatedDate] [datetime2](7) NULL,
	[UpdatedBy] [nvarchar](100) NULL,
	[UpdatedDate] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[BOMId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[CapacityAnalysis]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[CapacityAnalysis](
	[CapacityId] [int] IDENTITY(1,1) NOT NULL,
	[MachineId] [int] NOT NULL,
	[Date] [date] NOT NULL,
	[ShiftId] [int] NULL,
	[AvailableHours] [decimal](10, 2) NULL,
	[PlannedHours] [decimal](10, 2) NULL,
	[ActualHours] [decimal](10, 2) NULL,
	[UtilizationPercent] [decimal](5, 2) NULL,
	[OverloadFlag] [bit] NOT NULL,
	[CustomerId] [int] NOT NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[CreatedDate] [datetime2](7) NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[UpdatedDate] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[CapacityId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Cavity]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Cavity](
	[CavityId] [int] IDENTITY(1,1) NOT NULL,
	[CavityName] [nvarchar](50) NULL,
	[CavityNumber] [nvarchar](50) NULL,
	[RawMaterialId] [int] NULL,
	[MachineId] [int] NULL,
	[FGId] [int] NULL,
	[SFGNumber] [nvarchar](50) NULL,
	[MessageBox] [nvarchar](100) NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[UpdatedOn] [datetime] NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[CreatedOn] [datetime] NULL,
	[CompanyId] [int] NULL,
 CONSTRAINT [PK_Cavity] PRIMARY KEY CLUSTERED 
(
	[CavityId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ContainerCapacity]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ContainerCapacity](
	[ContainerCapacityId] [int] IDENTITY(1,1) NOT NULL,
	[ContainerCapacityName] [nvarchar](50) NOT NULL,
	[CompanyId] [int] NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[CreatedOn] [datetime] NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[UpdatedOn] [datetime] NULL,
 CONSTRAINT [PK_ContainerCapacity_1] PRIMARY KEY CLUSTERED 
(
	[ContainerCapacityId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Customer]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Customer](
	[CustomerId] [int] IDENTITY(1,1) NOT NULL,
	[CustomerCode] [nvarchar](50) NULL,
	[CustomerName] [nvarchar](50) NULL,
	[ContactNumber] [nvarchar](50) NULL,
	[Email] [nvarchar](50) NULL,
	[Address] [nvarchar](50) NULL,
	[CityId] [int] NULL,
	[StateId] [int] NULL,
	[CountryId] [int] NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[CreatedOn] [datetime] NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[UpdatedOn] [datetime] NULL,
	[CompanyId] [int] NULL,
	[IsActive] [bit] NULL,
	[DeactivatedDate] [datetime] NULL,
 CONSTRAINT [PK_Customer] PRIMARY KEY CLUSTERED 
(
	[CustomerId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[CustomerProductMapping_del]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[CustomerProductMapping_del](
	[CustomerId] [int] NOT NULL,
	[ProductId] [int] NOT NULL,
	[IsActive] [bit] NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[CreatedDate] [datetime] NULL,
	[UpdatedDate] [datetime] NULL,
	[UpdatedBy] [nchar](10) NULL,
 CONSTRAINT [PK_CustomerMaterialMapping] PRIMARY KEY CLUSTERED 
(
	[CustomerId] ASC,
	[ProductId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ExciseClassification]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ExciseClassification](
	[ExciseClassificationId] [int] IDENTITY(1,1) NOT NULL,
	[ExciseClassificationName] [nvarchar](50) NOT NULL,
	[CompanyId] [int] NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[CreatedOn] [datetime] NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[UpdatedOn] [datetime] NULL,
 CONSTRAINT [PK_ExciseClassification] PRIMARY KEY CLUSTERED 
(
	[ExciseClassificationId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[FGRMMapping]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[FGRMMapping](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[FGCode] [nvarchar](50) NULL,
	[RMCode] [nvarchar](50) NULL,
	[RMName] [nvarchar](50) NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[CreatedOn] [datetime] NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[UpdatedOn] [datetime] NULL,
	[CompanyId] [int] NULL,
	[RMQuantityPerKg] [decimal](18, 2) NULL,
	[RMGrade] [nvarchar](50) NULL,
 CONSTRAINT [PK_FGRMMapping] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[FGSFGMapping]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[FGSFGMapping](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[FGCode] [nvarchar](50) NULL,
	[FGName] [nvarchar](100) NULL,
	[SFGCode] [nvarchar](50) NULL,
	[SFGName] [nvarchar](50) NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[CreatedOn] [datetime] NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[UpdatedOn] [datetime] NULL,
	[CompanyId] [int] NULL,
	[Type] [nvarchar](10) NULL,
 CONSTRAINT [PK_FGSFGMapping] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[FinishedGood]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[FinishedGood](
	[FGId] [int] IDENTITY(1,1) NOT NULL,
	[RequestId] [nvarchar](50) NULL,
	[MaterialCode] [nvarchar](50) NULL,
	[MaterialName] [nvarchar](100) NULL,
	[Quantity] [decimal](18, 2) NULL,
	[FGQuantity] [decimal](18, 2) NULL,
	[BlockedQuantity] [decimal](18, 2) NULL,
	[NumberOfBags] [int] NULL,
	[KGInPerBags] [decimal](18, 2) NULL,
	[StoreId] [int] NULL,
	[UOM] [nvarchar](50) NULL,
	[Status] [nvarchar](50) NULL,
	[CreatedBy] [nvarchar](100) NULL,
	[CreatedOn] [datetime] NULL,
	[UpdatedBy] [nvarchar](100) NULL,
	[UpdatedOn] [datetime] NULL,
	[CompanyId] [int] NULL,
	[QRCodeUrl] [nvarchar](500) NULL,
	[BagName] [nvarchar](50) NULL,
	[IsHold] [bit] NULL,
	[Color] [nvarchar](50) NULL,
	[IsDispatch] [bit] NULL,
	[ReasonForRepackaging] [nvarchar](50) NULL,
	[RepackDate] [datetime] NULL,
	[IsActive] [bit] NULL,
	[Id] [int] NULL,
 CONSTRAINT [PK_FinishedGood] PRIMARY KEY CLUSTERED 
(
	[FGId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[GanttSchedule]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[GanttSchedule](
	[GanttId] [int] IDENTITY(1,1) NOT NULL,
	[WorkOrderId] [int] NOT NULL,
	[MachineId] [int] NULL,
	[StartDate] [datetime2](7) NOT NULL,
	[EndDate] [datetime2](7) NOT NULL,
	[Duration] [decimal](10, 2) NULL,
	[Color] [nvarchar](20) NULL,
	[Progress] [decimal](5, 2) NULL,
	[Dependencies] [nvarchar](500) NULL,
	[CustomerId] [int] NOT NULL,
	[ViewType] [nvarchar](50) NULL,
	[ScheduledStart] [datetime] NULL,
	[ScheduledEnd] [datetime] NULL,
	[GanttScheduleId] [int] NULL,
	[BarLabel] [nvarchar](200) NULL,
	[BarStatus] [nvarchar](50) NULL,
	[CreatedBy] [nvarchar](100) NULL,
	[CreatedDate] [datetime] NULL,
	[UpdatedBy] [nvarchar](100) NULL,
	[UpdatedDate] [datetime] NULL,
PRIMARY KEY CLUSTERED 
(
	[GanttId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Hold]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Hold](
	[Id] [int] NOT NULL,
	[RequestId] [nvarchar](50) NULL,
	[MaterialCode] [nvarchar](50) NULL,
	[MaterialName] [nvarchar](50) NULL,
	[Quantity] [decimal](18, 2) NULL,
	[HoldQuantity] [decimal](18, 2) NULL,
	[UOM] [nvarchar](50) NULL,
	[NumberOfBags] [int] NULL,
	[KGInPerBags] [decimal](18, 2) NULL,
	[OutputDate] [datetime] NULL,
	[Status] [nvarchar](50) NULL,
	[QRCodeUrl] [nvarchar](50) NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[CreatedOn] [datetime] NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[UpdatedOn] [datetime] NULL,
	[CompanyId] [int] NULL,
	[BagName] [nvarchar](50) NULL,
 CONSTRAINT [PK_Hold] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[HSNCode]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[HSNCode](
	[HSNCodeId] [int] IDENTITY(1,1) NOT NULL,
	[HSNCodeName] [nvarchar](50) NOT NULL,
	[CompanyId] [int] NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[CreatedOn] [datetime] NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[UpdatedOn] [datetime] NULL,
 CONSTRAINT [PK_HSNCode] PRIMARY KEY CLUSTERED 
(
	[HSNCodeId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Inventory]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Inventory](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[MaterialCode] [nvarchar](50) NOT NULL,
	[Category] [nvarchar](50) NOT NULL,
	[BlockedQuantity] [decimal](18, 2) NULL,
	[QuantityInStock] [decimal](18, 2) NULL,
	[UpdatedOn] [datetime] NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[CreatedOn] [datetime] NULL,
	[CompanyId] [int] NULL,
	[StockUpdatedReason] [nvarchar](200) NULL,
 CONSTRAINT [PK_Inventory_1] PRIMARY KEY CLUSTERED 
(
	[MaterialCode] ASC,
	[Category] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[InventoryByLot]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[InventoryByLot](
	[InventoryId] [int] IDENTITY(1,1) NOT NULL,
	[ProductId] [int] NOT NULL,
	[LotId] [int] NULL,
	[WarehouseCode] [nvarchar](20) NULL,
	[LocationCode] [nvarchar](20) NULL,
	[Quantity] [decimal](18, 4) NOT NULL,
	[ReservedQty] [decimal](18, 4) NOT NULL,
	[AvailableQty]  AS ([Quantity]-[ReservedQty]),
	[LastUpdated] [datetime2](7) NOT NULL,
	[CustomerId] [int] NOT NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[CreatedDate] [datetime2](7) NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[UpdatedDate] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[InventoryId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ItemCategory]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ItemCategory](
	[ItemCategoryId] [int] IDENTITY(1,1) NOT NULL,
	[ItemCategoryCode] [nvarchar](50) NOT NULL,
	[ItemCategoryName] [nvarchar](50) NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[CreatedOn] [datetime] NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[UpdatedOn] [datetime] NULL,
	[CompanyId] [int] NULL,
 CONSTRAINT [PK_ItemCategory] PRIMARY KEY CLUSTERED 
(
	[ItemCategoryId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ItemColour]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ItemColour](
	[ItemColourId] [int] IDENTITY(1,1) NOT NULL,
	[ItemColourName] [nvarchar](50) NOT NULL,
	[CompanyId] [int] NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[CreatedOn] [datetime] NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[UpdatedOn] [datetime] NULL,
 CONSTRAINT [PK_ItemColour] PRIMARY KEY CLUSTERED 
(
	[ItemColourId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ItemGroup]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ItemGroup](
	[ItemGroupId] [int] IDENTITY(1,1) NOT NULL,
	[ItemGroupCode] [nvarchar](50) NOT NULL,
	[ItemGroupName] [nvarchar](50) NULL,
	[CompanyId] [int] NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[CreatedOn] [datetime] NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[UpdatedOn] [datetime] NULL,
 CONSTRAINT [PK_ItemGroup_1] PRIMARY KEY CLUSTERED 
(
	[ItemGroupId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ItemMake]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ItemMake](
	[ItemMakeId] [int] IDENTITY(1,1) NOT NULL,
	[ItemMakeName] [nvarchar](50) NOT NULL,
	[CompanyId] [int] NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[CreatedOn] [datetime] NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[UpdatedOn] [datetime] NULL,
 CONSTRAINT [PK_ItemMake] PRIMARY KEY CLUSTERED 
(
	[ItemMakeId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ItemType]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ItemType](
	[ItemTypeId] [int] IDENTITY(1,1) NOT NULL,
	[ItemTypeName] [nvarchar](50) NOT NULL,
	[CompanyId] [int] NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[CreatedOn] [datetime] NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[UpdatedOn] [datetime] NULL,
 CONSTRAINT [PK_ItemType] PRIMARY KEY CLUSTERED 
(
	[ItemTypeId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[JumboPackaging]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[JumboPackaging](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[RequestId] [nvarchar](50) NULL,
	[PackagingType] [nvarchar](50) NULL,
	[ScrapQuantity] [decimal](18, 2) NULL,
	[KGInPerBag] [numeric](18, 0) NULL,
	[NumberOfBags] [int] NULL,
	[Status] [nvarchar](100) NULL,
	[Date] [datetime] NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[UpdatedOn] [datetime] NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[CreatedOn] [datetime] NULL,
	[CompanyId] [int] NULL,
	[QRCodeUrl] [nvarchar](100) NULL,
	[StoreId] [int] NULL,
	[RejectedQuantity] [decimal](18, 2) NULL,
	[BagName] [nvarchar](100) NULL,
	[Color] [nvarchar](50) NULL,
	[UOM] [nvarchar](50) NULL,
	[CustomerName] [nvarchar](100) NULL,
	[Category] [nvarchar](50) NULL,
	[TotalQuantity] [decimal](18, 2) NULL,
	[IsCompleted] [bit] NULL,
 CONSTRAINT [PK_JumboPackaging] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[LotMaster]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[LotMaster](
	[LotId] [int] IDENTITY(1,1) NOT NULL,
	[LotNumber] [nvarchar](50) NOT NULL,
	[ProductId] [int] NOT NULL,
	[ManufactureDate] [date] NULL,
	[ExpiryDate] [date] NULL,
	[Status] [nvarchar](20) NOT NULL,
	[CustomerId] [int] NOT NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[CreatedDate] [datetime2](7) NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[UpdatedDate] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[LotId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Machine]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Machine](
	[MachineId] [int] IDENTITY(1,1) NOT NULL,
	[MachineName] [nvarchar](50) NULL,
	[MachineCode] [nvarchar](50) NULL,
	[MachineType] [nvarchar](50) NULL,
	[Model] [nvarchar](50) NULL,
	[AverageWeight] [nvarchar](50) NULL,
	[PieceOrBox] [nvarchar](50) NULL,
	[BoxWeight] [nvarchar](50) NULL,
	[Status] [nvarchar](50) NULL,
	[Capacity] [nvarchar](50) NULL,
	[LastServiceDate] [datetime] NULL,
	[NextServiceDue] [datetime] NULL,
	[ProductionPerDay] [nvarchar](50) NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[CreatedOn] [datetime] NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[UpdatedOn] [datetime] NULL,
	[CompanyId] [int] NULL,
	[QRCodeUrl] [nvarchar](100) NULL,
	[FGName] [nvarchar](50) NULL,
 CONSTRAINT [PK_Machine] PRIMARY KEY CLUSTERED 
(
	[MachineId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[MachineFGMapping]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[MachineFGMapping](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[MachineType] [nvarchar](50) NULL,
	[FGCode] [nvarchar](50) NULL,
	[FGName] [nvarchar](50) NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[CreatedOn] [datetime] NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[UpdatedOn] [datetime] NULL,
	[CompanyId] [int] NULL,
	[CycleTime] [decimal](18, 2) NULL,
	[AverageWeight] [decimal](10, 2) NULL,
	[NoOfCavities] [int] NULL,
 CONSTRAINT [PK_MachineSFGMapping] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[MachineMaster]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[MachineMaster](
	[MachineId] [int] IDENTITY(1,1) NOT NULL,
	[MachineCode] [nvarchar](50) NOT NULL,
	[MachineName] [nvarchar](100) NOT NULL,
	[MachineType] [nvarchar](50) NULL,
	[Location] [nvarchar](100) NULL,
	[CapacityPerHour] [decimal](10, 2) NULL,
	[AvailableHoursPerDay] [decimal](5, 2) NULL,
	[EfficiencyPercent] [decimal](5, 2) NULL,
	[Status] [nvarchar](20) NULL,
	[IsActive] [bit] NOT NULL,
	[CustomerId] [int] NOT NULL,
	[CreatedBy] [nvarchar](100) NULL,
	[CreatedDate] [datetime2](7) NULL,
	[UpdatedBy] [nvarchar](100) NULL,
	[UpdatedDate] [datetime2](7) NULL,
	[Capacity] [decimal](18, 2) NULL,
	[MinCapacity] [decimal](18, 2) NULL,
	[MaxCapacity] [decimal](18, 2) NULL,
	[LastMaintDate] [datetime] NULL,
	[NextMaintDate] [datetime] NULL,
	[Shift] [nvarchar](50) NULL,
	[Utilization] [decimal](10, 2) NULL,
	[WorkCenter] [nvarchar](100) NULL,
	[Role] [nvarchar](100) NULL,
	[Skills] [nvarchar](200) NULL,
PRIMARY KEY CLUSTERED 
(
	[MachineId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[MachineMaterialMapping]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[MachineMaterialMapping](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[MachineId] [int] NULL,
	[RMCode] [nvarchar](50) NULL,
	[SFGCode] [nvarchar](50) NULL,
	[FGCode] [nvarchar](50) NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[CreatedOn] [datetime] NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[UpdatedOn] [datetime] NULL,
	[CompanyId] [int] NULL,
 CONSTRAINT [PK_MachineMaterialMapping] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[MaintenanceWindow]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[MaintenanceWindow](
	[MaintenanceId] [int] IDENTITY(1,1) NOT NULL,
	[MachineId] [int] NOT NULL,
	[MaintenanceType] [nvarchar](50) NOT NULL,
	[StartDate] [datetime2](7) NOT NULL,
	[EndDate] [datetime2](7) NOT NULL,
	[Description] [nvarchar](500) NULL,
	[Status] [nvarchar](20) NOT NULL,
	[CustomerId] [int] NOT NULL,
	[Title] [nvarchar](200) NULL,
	[AlertType] [nvarchar](20) NULL,
	[DurationHours] [decimal](5, 1) NOT NULL,
	[WorkCenterCode] [nvarchar](50) NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[CreatedDate] [datetime2](7) NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[UpdatedDate] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[MaintenanceId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[MaterialDispatch]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[MaterialDispatch](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[SONumber] [nvarchar](50) NULL,
	[RequestId]  AS ('DIS'+right('0000'+CONVERT([varchar](7),[Id]),(7))),
	[CustomerCode] [nvarchar](50) NULL,
	[NumberOfBags] [int] NULL,
	[KGInPerBags] [decimal](18, 2) NULL,
	[MonthYear] [nvarchar](6) NULL,
	[Quantity] [decimal](18, 2) NULL,
	[UOM] [nvarchar](50) NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[CreatedOn] [datetime] NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[UpdatedOn] [datetime] NULL,
	[CompanyId] [int] NULL,
	[QRCodeUrl] [nvarchar](500) NULL,
	[Status] [nvarchar](50) NULL,
	[DispatchDate] [datetime] NULL,
	[TotalQuantity] [decimal](18, 2) NULL,
	[LoadedQuantity] [decimal](18, 2) NULL,
	[UnloadedQuantity] [decimal](18, 2) NULL,
	[Comments] [nvarchar](1000) NULL,
	[FinalDispatchQty] [decimal](18, 2) NULL,
 CONSTRAINT [PK_MaterialDispatch] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Materials]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Materials](
	[MaterialCode] [nvarchar](50) NOT NULL,
	[ReferenceNo] [int] IDENTITY(1,1) NOT NULL,
	[MaterialName] [nvarchar](50) NULL,
	[PrintName] [nvarchar](50) NULL,
	[DisplayName] [nvarchar](50) NULL,
	[NameInTally] [nvarchar](50) NULL,
	[Description] [nvarchar](100) NULL,
	[ItemGroup] [nvarchar](50) NULL,
	[ItemCategory] [nvarchar](50) NULL,
	[AssetType] [nvarchar](50) NULL,
	[ServiceType] [nvarchar](50) NULL,
	[DefaultStoreName] [nvarchar](50) NULL,
	[MeasurementUnit] [nvarchar](50) NULL,
	[AlternateUnit] [nvarchar](50) NULL,
	[PackingUnit] [nvarchar](50) NULL,
	[PackingSize] [int] NULL,
	[BaseConversionRatio] [nvarchar](50) NULL,
	[AlternateConversionRatio] [nvarchar](50) NULL,
	[SellingPrice] [nvarchar](50) NULL,
	[MinimumStock] [decimal](18, 2) NULL,
	[MaximumStock] [decimal](18, 2) NULL,
	[ExciseClassification] [nvarchar](50) NULL,
	[ItemType] [nvarchar](50) NULL,
	[NeckType] [nvarchar](50) NULL,
	[Colour] [nvarchar](50) NULL,
	[SpareType] [nvarchar](50) NULL,
	[PlasticMaterialType] [nvarchar](50) NULL,
	[PlasticCategory] [nvarchar](50) NULL,
	[ContainerCapacity] [nvarchar](50) NULL,
	[Tolerance] [nvarchar](50) NULL,
	[DefaultLocation] [nvarchar](50) NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[CreatedOn] [datetime] NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[UpdatedOn] [datetime] NULL,
	[CompanyId] [int] NULL,
	[RMGrade] [nvarchar](50) NULL,
 CONSTRAINT [PK_Item] PRIMARY KEY CLUSTERED 
(
	[MaterialCode] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[MaterialTransit]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[MaterialTransit](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[MaterialCode] [nvarchar](50) NOT NULL,
	[Quantity] [decimal](18, 2) NULL,
	[InTransit] [bit] NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[CreatedOn] [datetime] NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[UpdatedOn] [datetime] NULL,
	[CompanyId] [int] NULL,
	[MaterialName] [nvarchar](50) NULL,
 CONSTRAINT [PK_MaterialTransit] PRIMARY KEY CLUSTERED 
(
	[MaterialCode] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[MeasurementUnit]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[MeasurementUnit](
	[MeasurementUnitId] [int] IDENTITY(1,1) NOT NULL,
	[MeasurementUnitName] [nvarchar](50) NOT NULL,
	[AlternateUnit] [bit] NULL,
	[CompanyId] [int] NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[CreatedOn] [datetime] NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[UpdatedOn] [datetime] NULL,
 CONSTRAINT [PK_MeasurementUnit] PRIMARY KEY CLUSTERED 
(
	[MeasurementUnitId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[MPSHeader]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[MPSHeader](
	[MpsHeaderId] [int] IDENTITY(1,1) NOT NULL,
	[MpsNumber] [nvarchar](20) NULL,
	[Description] [nvarchar](200) NULL,
	[PlanningPeriod] [nvarchar](20) NULL,
	[StartDate] [date] NULL,
	[EndDate] [date] NULL,
	[Status] [nvarchar](20) NULL,
	[ApprovedBy] [nvarchar](100) NULL,
	[ApprovedDate] [datetime2](7) NULL,
	[IsActive] [bit] NULL,
	[CustomerId] [int] NOT NULL,
	[CreatedBy] [nvarchar](100) NULL,
	[CreatedDate] [datetime2](7) NULL,
	[UpdatedBy] [nvarchar](100) NULL,
	[UpdatedDate] [datetime2](7) NULL,
 CONSTRAINT [PK__MPSHeade__82FFF59D2A269105] PRIMARY KEY CLUSTERED 
(
	[MpsHeaderId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[MpsMaster]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[MpsMaster](
	[MpsId] [int] IDENTITY(1,1) NOT NULL,
	[MpsHeaderId] [int] NOT NULL,
	[ProductId] [int] NOT NULL,
	[PlannedQty] [decimal](18, 4) NULL,
	[PeriodType] [nvarchar](20) NULL,
	[PeriodStart] [date] NULL,
	[PeriodEnd] [date] NULL,
	[DueDate] [date] NULL,
	[DemandSource] [nvarchar](50) NULL,
	[SalesOrderRef] [nvarchar](50) NULL,
	[Status] [nvarchar](20) NULL,
	[IsConverted] [bit] NULL,
	[WorkOrderId] [int] NULL,
	[Notes] [nvarchar](500) NULL,
	[IsActive] [bit] NULL,
	[CustomerId] [int] NOT NULL,
	[CreatedBy] [nvarchar](100) NULL,
	[CreatedDate] [datetime2](7) NULL,
	[UpdatedBy] [nvarchar](100) NULL,
	[UpdatedDate] [datetime2](7) NULL,
	[PlantId] [int] NULL,
	[ProductCode] [nvarchar](max) NULL,
	[Forecast] [int] NULL,
	[PlannedOrders] [int] NULL,
	[ProductionQty] [int] NULL,
	[Week1] [int] NULL,
	[Week2] [int] NULL,
	[Week3] [int] NULL,
	[Week4] [int] NULL,
	[ProjectedStock] [int] NULL,
	[MachineName] [nvarchar](max) NULL,
	[CapacityMode] [nvarchar](max) NULL,
	[CapacityValue] [int] NULL,
	[Version] [nvarchar](max) NULL,
	[WeeklyPlan] [nvarchar](max) NULL,
 CONSTRAINT [PK__MpsMaste__86EBC2B4A5D00D77] PRIMARY KEY CLUSTERED 
(
	[MpsId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[MPSRawMaterialRequirement]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[MPSRawMaterialRequirement](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[MpsId] [int] NOT NULL,
	[ProductId] [int] NOT NULL,
	[MaterialId] [int] NOT NULL,
	[RMCode] [nvarchar](100) NOT NULL,
	[RMName] [nvarchar](250) NOT NULL,
	[QtyPerFG] [decimal](18, 3) NOT NULL,
	[FGQty] [decimal](18, 3) NOT NULL,
	[RequiredQty] [decimal](18, 3) NOT NULL,
	[AvailableStock] [decimal](18, 3) NOT NULL,
	[ShortageQty] [decimal](18, 3) NOT NULL,
	[Status] [nvarchar](30) NOT NULL,
	[CompanyId] [int] NULL,
	[PlantId] [int] NULL,
	[CreatedBy] [nvarchar](100) NULL,
	[CreatedOn] [datetime] NOT NULL,
	[UpdatedBy] [nvarchar](100) NULL,
	[UpdatedOn] [datetime] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[MRP_Demand]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[MRP_Demand](
	[DemandId] [int] IDENTITY(1,1) NOT NULL,
	[MrpRunId] [int] NOT NULL,
	[ProductId] [int] NOT NULL,
	[DemandSource] [nvarchar](50) NULL,
	[SourceReference] [nvarchar](50) NULL,
	[RequiredQty] [decimal](18, 4) NOT NULL,
	[RequiredDate] [date] NOT NULL,
	[CustomerId] [int] NOT NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[CreatedDate] [datetime2](7) NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[UpdatedDate] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[DemandId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[MRP_Result]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[MRP_Result](
	[ResultId] [int] IDENTITY(1,1) NOT NULL,
	[MrpRunId] [int] NOT NULL,
	[ProductId] [int] NOT NULL,
	[ActionType] [nvarchar](50) NOT NULL,
	[SuggestedQty] [decimal](18, 4) NOT NULL,
	[SuggestedDate] [date] NOT NULL,
	[CurrentStock] [decimal](18, 4) NULL,
	[ShortageQty] [decimal](18, 4) NULL,
	[IsAccepted] [bit] NOT NULL,
	[WorkOrderId] [int] NULL,
	[CustomerId] [int] NOT NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[CreatedDate] [datetime2](7) NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[UpdatedDate] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[ResultId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[MRP_Run]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[MRP_Run](
	[MrpRunId] [int] IDENTITY(1,1) NOT NULL,
	[RunNumber] [nvarchar](20) NOT NULL,
	[RunDate] [datetime2](7) NOT NULL,
	[PlanningHorizonDays] [int] NOT NULL,
	[Status] [nvarchar](20) NOT NULL,
	[TotalDemands] [int] NULL,
	[TotalSuggestions] [int] NULL,
	[CompletedDate] [datetime2](7) NULL,
	[RunBy] [nvarchar](100) NULL,
	[CustomerId] [int] NOT NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[CreatedDate] [datetime2](7) NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[UpdatedDate] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[MrpRunId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[NeckType]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[NeckType](
	[NeckTypeId] [int] IDENTITY(1,1) NOT NULL,
	[NeckTypeName] [nvarchar](50) NOT NULL,
	[NeckDescription] [nvarchar](100) NULL,
	[ParentNeckName] [nvarchar](50) NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[CreatedOn] [datetime] NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[UpdatedOn] [datetime] NULL,
	[CompanyId] [int] NULL,
 CONSTRAINT [PK_NeckType_1] PRIMARY KEY CLUSTERED 
(
	[NeckTypeId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[NotificationRule]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[NotificationRule](
	[RuleId] [int] IDENTITY(1,1) NOT NULL,
	[RuleName] [nvarchar](100) NOT NULL,
	[AlertType] [nvarchar](50) NOT NULL,
	[Condition] [nvarchar](max) NULL,
	[Recipients] [nvarchar](max) NULL,
	[NotifyEmail] [bit] NOT NULL,
	[NotifySMS] [bit] NOT NULL,
	[NotifyInApp] [bit] NOT NULL,
	[IsActive] [bit] NOT NULL,
	[CustomerId] [int] NOT NULL,
	[CreatedBy] [nvarchar](100) NULL,
	[UpdatedBy] [nvarchar](100) NULL,
	[CreatedDate] [datetime] NULL,
	[UpdatedDate] [datetime] NULL,
	[EscalationMinutes] [nvarchar](50) NULL,
PRIMARY KEY CLUSTERED 
(
	[RuleId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[OnlineHold]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[OnlineHold](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[RequestId] [nvarchar](50) NULL,
	[MaterialCode] [nvarchar](50) NULL,
	[MaterialName] [nvarchar](50) NULL,
	[Quantity] [decimal](18, 2) NULL,
	[OnlineHoldQuantity] [decimal](18, 2) NULL,
	[UOM] [nvarchar](50) NULL,
	[NumberOfBags] [int] NULL,
	[KGInPerBags] [decimal](18, 2) NULL,
	[OutputDate] [datetime] NULL,
	[Status] [nvarchar](100) NULL,
	[StoreId] [int] NULL,
	[QRCodeUrl] [nvarchar](100) NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[CreatedOn] [datetime] NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[UpdatedOn] [datetime] NULL,
	[CompanyId] [int] NULL,
	[BagName] [nvarchar](50) NULL,
	[Color] [nvarchar](50) NULL,
 CONSTRAINT [PK__OnlineHo__3214EC076F3E1730] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[OperatorMaster]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[OperatorMaster](
	[OperatorId] [int] IDENTITY(1,1) NOT NULL,
	[OperatorCode] [nvarchar](50) NOT NULL,
	[OperatorName] [nvarchar](100) NOT NULL,
	[Department] [nvarchar](50) NULL,
	[Skill] [nvarchar](50) NULL,
	[ShiftId] [int] NULL,
	[IsActive] [bit] NOT NULL,
	[CustomerId] [int] NOT NULL,
	[CreatedBy] [nvarchar](100) NULL,
	[CreatedDate] [datetime2](7) NULL,
	[UpdatedBy] [nvarchar](100) NULL,
	[UpdatedDate] [datetime2](7) NULL,
	[Role] [nvarchar](100) NULL,
	[Shift] [nvarchar](50) NULL,
	[Skills] [nvarchar](500) NULL,
	[Status] [nvarchar](50) NULL,
	[Utilization] [decimal](18, 2) NULL,
	[WorkCenter] [nvarchar](100) NULL,
PRIMARY KEY CLUSTERED 
(
	[OperatorId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[PackagingType]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[PackagingType](
	[PackagingTypeId] [int] IDENTITY(1,1) NOT NULL,
	[PackagingTypeName] [nvarchar](50) NOT NULL,
	[Capacity] [nvarchar](50) NULL,
	[CompanyId] [int] NULL,
	[CreatedOn] [datetime] NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[UpdatedOn] [datetime] NULL,
	[UpdatedBy] [nvarchar](50) NULL,
 CONSTRAINT [PK_PackagingType_1] PRIMARY KEY CLUSTERED 
(
	[PackagingTypeId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[PlasticCategory]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[PlasticCategory](
	[PlasticCategoryId] [int] IDENTITY(1,1) NOT NULL,
	[PlasticCategoryName] [nvarchar](50) NOT NULL,
	[CompanyId] [int] NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[CreatedOn] [datetime] NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[UpdatedOn] [datetime] NULL,
 CONSTRAINT [PK_PlasticCategory] PRIMARY KEY CLUSTERED 
(
	[PlasticCategoryId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[PlasticMaterialType]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[PlasticMaterialType](
	[PlasticTypeId] [int] IDENTITY(1,1) NOT NULL,
	[PlasticTypeName] [nvarchar](50) NOT NULL,
	[CompanyId] [int] NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[CreatedOn] [datetime] NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[UpdatedOn] [datetime] NULL,
 CONSTRAINT [PK_PlasticType] PRIMARY KEY CLUSTERED 
(
	[PlasticTypeId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[PODetails]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[PODetails](
	[PONumber] [nvarchar](50) NOT NULL,
	[Quantity] [decimal](18, 0) NULL,
	[UnitOfMeasurement] [nvarchar](50) NULL,
	[VendorCode] [nvarchar](50) NULL,
	[MaterialCode] [nvarchar](50) NULL,
	[MaterialName] [nvarchar](50) NULL,
	[RMGradeId] [int] NULL,
	[Price] [nvarchar](50) NULL,
	[Status] [nvarchar](50) NULL,
	[RejectedReason] [nvarchar](200) NULL,
	[PODate] [datetime] NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[CreatedOn] [datetime] NULL,
	[UpdatedOn] [datetime] NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[CompanyId] [int] NULL,
	[BillRate] [nvarchar](50) NULL,
 CONSTRAINT [PK_PODetails] PRIMARY KEY CLUSTERED 
(
	[PONumber] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[PriorityMaster]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[PriorityMaster](
	[PriorityId] [int] IDENTITY(1,1) NOT NULL,
	[PriorityCode] [nvarchar](20) NOT NULL,
	[PriorityName] [nvarchar](50) NOT NULL,
	[PriorityLevel] [int] NOT NULL,
	[Color] [nvarchar](20) NULL,
	[Description] [nvarchar](200) NULL,
	[IsActive] [bit] NOT NULL,
	[CustomerId] [int] NOT NULL,
	[CreatedBy] [nvarchar](100) NULL,
	[CreatedDate] [datetime2](7) NULL,
	[UpdatedBy] [nvarchar](100) NULL,
	[UpdatedDate] [datetime2](7) NULL,
	[PriorityWeight] [int] NULL,
	[SlaHours] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[PriorityId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Product_del]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Product_del](
	[ProductId] [int] IDENTITY(1,1) NOT NULL,
	[ProductName] [nvarchar](50) NULL,
	[ProductCode] [nvarchar](50) NULL,
	[Category] [nvarchar](50) NULL,
	[BrandName] [nvarchar](50) NULL,
	[Tags] [nvarchar](50) NULL,
	[Description] [nvarchar](50) NULL,
	[IsActive] [bit] NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[CreatedOn] [datetime] NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[UpdatedOn] [datetime] NULL,
	[Price] [nvarchar](50) NULL,
	[StockQuantity] [nvarchar](50) NULL,
	[FGId] [int] NULL,
	[CompanyId] [int] NULL,
 CONSTRAINT [PK_Product] PRIMARY KEY CLUSTERED 
(
	[ProductId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ProductionPlanning]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ProductionPlanning](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[RequestId]  AS ('PP'+right('0000'+CONVERT([varchar](5),[Id]),(5))),
	[MachineId] [int] NULL,
	[FGQuantity] [decimal](18, 2) NULL,
	[FGCode] [nvarchar](50) NULL,
	[FGName] [nvarchar](50) NULL,
	[RMCode] [nvarchar](50) NULL,
	[RMName] [nvarchar](50) NULL,
	[RMQuantity] [decimal](18, 2) NULL,
	[QuantityInMT] [decimal](18, 2) NULL,
	[Color] [nvarchar](50) NULL,
	[PackagingType] [nvarchar](50) NULL,
	[InstructionForOperation] [nvarchar](100) NULL,
	[MarketingRemarks] [nvarchar](500) NULL,
	[RemarksByProduction] [nvarchar](100) NULL,
	[Date] [datetime] NULL,
	[InputQuantity] [decimal](18, 2) NULL,
	[InputDate] [datetime] NULL,
	[NumberOfBags] [int] NULL,
	[KGInPerBag] [decimal](18, 2) NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[CreatedOn] [datetime] NULL,
	[UpdatedOn] [datetime] NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[CompanyId] [int] NULL,
	[QRCodeUrl] [nvarchar](100) NULL,
	[Status] [nvarchar](50) NULL,
	[RMBagName] [nvarchar](50) NULL,
	[MachineCode] [nvarchar](50) NULL,
 CONSTRAINT [PK_ProductionPlanning] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ProductMaster]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ProductMaster](
	[ProductId] [int] IDENTITY(1,1) NOT NULL,
	[ProductCode] [nvarchar](50) NOT NULL,
	[ProductName] [nvarchar](255) NOT NULL,
	[ProductType] [nvarchar](10) NULL,
	[UOM] [nvarchar](20) NULL,
	[Description] [nvarchar](500) NULL,
	[StandardCost] [decimal](18, 4) NULL,
	[LeadTimeDays] [int] NULL,
	[SafetyStock] [decimal](18, 4) NULL,
	[IsActive] [bit] NOT NULL,
	[CustomerId] [int] NOT NULL,
	[CreatedBy] [nvarchar](100) NULL,
	[CreatedDate] [datetime2](7) NULL,
	[UpdatedBy] [nvarchar](100) NULL,
	[UpdatedDate] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[ProductId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[PurchaseReturn]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[PurchaseReturn](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[TransactionID] [nvarchar](50) NULL,
	[PONumber] [nvarchar](50) NULL,
	[PartyInvoiceNo] [nvarchar](50) NULL,
	[PartyInvoiceDate] [datetime] NULL,
	[ItemName] [nvarchar](50) NULL,
	[ItemCode] [nvarchar](50) NULL,
	[ReturnQty] [decimal](18, 2) NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[CreatedOn] [datetime] NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[UpdatedOn] [datetime] NULL,
	[CompanyId] [int] NULL,
	[PurchaseReturnDate] [datetime] NULL,
	[NumberOfBags] [int] NULL,
 CONSTRAINT [PK_PurchaseReturn] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[RawMaterial]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[RawMaterial](
	[RawMaterialId] [int] IDENTITY(1,1) NOT NULL,
	[RawMaterialName] [nvarchar](50) NULL,
	[PackagingType] [nvarchar](50) NULL,
	[RawMaterialGrade] [nvarchar](50) NULL,
	[RawMaterialWeight] [decimal](18, 2) NULL,
	[VendorId] [int] NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[CreatedOn] [datetime] NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[UpdatedOn] [datetime] NULL,
	[CompanyId] [int] NULL,
 CONSTRAINT [PK_RawMaterial] PRIMARY KEY CLUSTERED 
(
	[RawMaterialId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[RawMaterial_FG_SFGMapping]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[RawMaterial_FG_SFGMapping](
	[RawMaterialId] [int] NOT NULL,
	[FGName] [nvarchar](50) NOT NULL,
	[SFGName] [nvarchar](50) NOT NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[CreatedOn] [datetime] NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[UpdatedOn] [datetime] NULL,
	[CompanyId] [int] NULL,
	[IsActive] [bit] NULL,
 CONSTRAINT [PK_RawMaterial_FG_SFGMapping] PRIMARY KEY CLUSTERED 
(
	[RawMaterialId] ASC,
	[FGName] ASC,
	[SFGName] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Rejected]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Rejected](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[RequestId] [nvarchar](50) NULL,
	[MaterialCode] [nvarchar](50) NULL,
	[MaterialName] [nvarchar](100) NULL,
	[Quantity] [decimal](18, 2) NULL,
	[RejectedQuantity] [decimal](18, 2) NULL,
	[UOM] [nvarchar](50) NULL,
	[NumberOfBags] [int] NULL,
	[KGInPerBags] [decimal](18, 2) NULL,
	[OutputDate] [datetime] NULL,
	[Status] [nvarchar](50) NULL,
	[StoreId] [int] NULL,
	[QRCodeUrl] [nvarchar](100) NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[CreatedOn] [datetime] NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[UpdatedOn] [datetime] NULL,
	[CompanyId] [int] NULL,
	[BagName] [nvarchar](100) NULL,
	[Color] [nvarchar](50) NULL,
	[ReasonForRepackaging] [nvarchar](50) NULL,
	[RepackDate] [datetime] NULL,
 CONSTRAINT [PK_Rejected] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Repackaging]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Repackaging](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[RequestId] [nvarchar](50) NULL,
	[MaterialCode] [nvarchar](50) NULL,
	[MaterialName] [nvarchar](100) NULL,
	[Quantity] [decimal](18, 2) NULL,
	[NumberOfBags] [int] NULL,
	[KGInPerBag] [decimal](18, 2) NULL,
	[BagName] [nvarchar](50) NULL,
	[Remarks] [nvarchar](100) NULL,
	[Date] [datetime] NULL,
	[CompanyId] [int] NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[UpdatedOn] [datetime] NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[CreatedOn] [datetime] NULL,
	[CustomerName] [nvarchar](100) NULL,
	[UOM] [nchar](10) NULL,
	[Color] [nvarchar](50) NULL,
	[QRCodeUrl] [nvarchar](500) NULL,
	[SONumber] [nvarchar](50) NULL,
	[Status] [nvarchar](50) NULL,
	[IsActive] [bit] NULL,
	[FGId] [int] NULL,
 CONSTRAINT [PK_Repackaging] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ReturnData]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ReturnData](
	[ReturnId] [int] IDENTITY(1,1) NOT NULL,
	[RequestId]  AS ('RR'+right('0000'+CONVERT([varchar](5),[ReturnId]),(5))),
	[MaterialCode] [nvarchar](50) NULL,
	[MaterialName] [nvarchar](100) NULL,
	[QuantityReturned] [decimal](18, 2) NULL,
	[NumberOfBags] [int] NULL,
	[KGInPerBag] [decimal](18, 2) NULL,
	[BagName] [nvarchar](50) NULL,
	[Remarks] [nvarchar](100) NULL,
	[Date] [datetime] NULL,
	[CompanyId] [int] NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[UpdatedOn] [datetime] NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[CreatedOn] [datetime] NULL,
	[CustomerName] [nvarchar](100) NULL,
	[UOM] [nchar](10) NULL,
	[Color] [nvarchar](50) NULL,
	[SONumber] [nvarchar](50) NULL,
	[DispatchNumber] [nvarchar](50) NULL,
	[DispatchQuantity] [decimal](18, 2) NULL,
	[FGId] [int] NULL,
	[IsActive] [bit] NULL,
 CONSTRAINT [PK_ReturnData] PRIMARY KEY CLUSTERED 
(
	[ReturnId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[RMGrade]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[RMGrade](
	[RMGradeId] [int] IDENTITY(1,1) NOT NULL,
	[RMGradeName] [nvarchar](50) NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[CreatedOn] [datetime] NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[UpdatedOn] [datetime] NULL,
	[CompanyId] [int] NULL,
 CONSTRAINT [PK_RMGrade] PRIMARY KEY CLUSTERED 
(
	[RMGradeId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[RMInvoice]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[RMInvoice](
	[PONumber] [nvarchar](50) NOT NULL,
	[ItemCode] [nvarchar](50) NOT NULL,
	[ItemName] [nvarchar](200) NULL,
	[BillRate] [decimal](18, 2) NULL,
	[BillBaseQuantity] [decimal](18, 2) NULL,
	[ReceivedQuantity] [decimal](18, 2) NULL,
	[InvoiceNumber] [nvarchar](50) NULL,
	[InvoiceDate] [datetime] NULL,
	[Price] [decimal](18, 2) NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[CreatedOn] [datetime] NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[UpdatedOn] [datetime] NULL,
	[CompanyId] [int] NULL,
	[SendToERP] [bit] NULL,
	[SendOn] [datetime] NULL,
 CONSTRAINT [PK_RMInvoice] PRIMARY KEY CLUSTERED 
(
	[PONumber] ASC,
	[ItemCode] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[RMInward]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[RMInward](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[RequestId]  AS ('RM'+right('0000'+CONVERT([varchar](5),[Id]),(5))),
	[PONumber] [nvarchar](50) NULL,
	[ItemCode] [nvarchar](50) NULL,
	[ItemName] [nvarchar](50) NULL,
	[BillBaseQuantity] [nvarchar](50) NULL,
	[RMGradeId] [int] NULL,
	[InvoiceNumber] [nvarchar](50) NULL,
	[InvoiceDate] [datetime] NULL,
	[VehicleNumber] [nvarchar](50) NULL,
	[PendingQuantity] [nvarchar](50) NULL,
	[BatchId] [nvarchar](50) NULL,
	[Specification] [nvarchar](100) NULL,
	[ReceivedQuantity] [decimal](18, 0) NULL,
	[ReceivedQuantityUnit] [nvarchar](50) NULL,
	[LotNumber] [nvarchar](50) NULL,
	[RMInwardDate] [datetime] NULL,
	[Price] [nvarchar](50) NULL,
	[NumberOfBags] [nvarchar](50) NULL,
	[KGInPerBags] [decimal](18, 2) NULL,
	[Status] [nvarchar](50) NULL,
	[StoreId] [int] NULL,
	[StoreAssignedDate] [datetime] NULL,
	[MaterialConditions] [nvarchar](500) NULL,
	[QRCodeUrl] [nvarchar](500) NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[CreatedOn] [datetime] NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[UpdatedOn] [datetime] NULL,
	[CompanyId] [int] NULL,
	[RejectedQuantity] [decimal](18, 0) NULL,
	[ApprovedQuantity] [decimal](18, 0) NULL,
	[AvailableQuantity] [decimal](18, 0) NULL,
	[ApprovedNumberOfBags] [int] NULL,
	[RejectedNumberOfBags] [int] NULL,
	[ReturnQuantity] [decimal](18, 2) NULL,
	[RMHoldQuantity] [decimal](18, 2) NULL,
	[HoldNumberOfBags] [int] NULL,
	[BillRate] [nvarchar](50) NULL,
	[OrderRate] [nvarchar](50) NULL,
 CONSTRAINT [PK_RMInward] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[RMInwardDetails]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[RMInwardDetails](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[RequestId] [nvarchar](50) NULL,
	[ItemCode] [nvarchar](50) NULL,
	[ItemName] [nvarchar](50) NULL,
	[QuantityInPerBag] [decimal](18, 0) NULL,
	[QRCodeUrl] [nvarchar](100) NULL,
	[IsScanned] [bit] NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[CreatedOn] [datetime] NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[UpdatedOn] [datetime] NULL,
	[CompanyId] [int] NULL,
	[BagName] [nvarchar](50) NULL,
	[Comments] [nvarchar](100) NULL,
	[Category] [nvarchar](50) NULL,
	[Status] [nvarchar](50) NULL,
	[IsPriority] [bit] NULL,
 CONSTRAINT [PK_RMInwardApproved] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[RoutingMaster]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[RoutingMaster](
	[RoutingId] [int] IDENTITY(1,1) NOT NULL,
	[ProductId] [int] NOT NULL,
	[RoutingCode] [nvarchar](50) NOT NULL,
	[RoutingName] [nvarchar](100) NOT NULL,
	[Version] [nvarchar](20) NULL,
	[TotalTimeMinutes] [decimal](10, 2) NULL,
	[Status] [nvarchar](20) NULL,
	[IsActive] [bit] NOT NULL,
	[CustomerId] [int] NOT NULL,
	[CreatedBy] [nvarchar](100) NULL,
	[CreatedDate] [datetime2](7) NULL,
	[UpdatedBy] [nvarchar](100) NULL,
	[UpdatedDate] [datetime2](7) NULL,
	[OperationSeq] [int] NULL,
	[WorkCenterId] [int] NULL,
	[StdCycleTime] [decimal](18, 2) NULL,
PRIMARY KEY CLUSTERED 
(
	[RoutingId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[RoutingStep]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[RoutingStep](
	[RoutingStepId] [int] IDENTITY(1,1) NOT NULL,
	[RoutingTemplateId] [int] NOT NULL,
	[Seq] [int] NOT NULL,
	[Operation] [nvarchar](200) NULL,
	[WorkCenter] [nvarchar](50) NULL,
	[Machine] [nvarchar](100) NULL,
	[SetupTime] [nvarchar](20) NULL,
	[RunTime] [nvarchar](20) NULL,
	[WaitTime] [nvarchar](20) NULL,
	[TotalTime] [nvarchar](20) NULL,
	[Skill] [nvarchar](100) NULL,
	[Status] [nvarchar](20) NULL,
	[CustomerId] [int] NOT NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[CreatedDate] [datetime2](7) NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[UpdatedDate] [datetime2](7) NULL,
 CONSTRAINT [PK__RoutingS__06F27B28DB6B5657] PRIMARY KEY CLUSTERED 
(
	[RoutingStepId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[RoutingTemplate]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[RoutingTemplate](
	[RoutingTemplateId] [int] IDENTITY(1,1) NOT NULL,
	[TemplateCode] [nvarchar](20) NOT NULL,
	[TemplateName] [nvarchar](200) NOT NULL,
	[ProductCode] [nvarchar](50) NULL,
	[Version] [nvarchar](20) NULL,
	[Status] [nvarchar](30) NULL,
	[CustomerId] [int] NOT NULL,
	[CreatedDate] [datetime2](7) NULL,
	[UpdatedDate] [datetime2](7) NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[UpdatedBy] [nvarchar](50) NULL,
 CONSTRAINT [PK__RoutingT__D805B9A223B774AD] PRIMARY KEY CLUSTERED 
(
	[RoutingTemplateId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[SalesForecastHeader]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SalesForecastHeader](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[RequestId]  AS ('SF'+right('0000'+CONVERT([varchar](7),[Id]),(7))),
	[SalePersonId] [int] NOT NULL,
	[MonthYear] [nvarchar](6) NOT NULL,
	[Status] [nvarchar](50) NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[CreatedOn] [datetime] NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[UpdatedOn] [datetime] NULL,
	[CompanyId] [int] NULL,
	[CustomerId] [int] NULL,
 CONSTRAINT [PK_SalesForecastHeader] PRIMARY KEY CLUSTERED 
(
	[SalePersonId] ASC,
	[MonthYear] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[SalesForecasts]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SalesForecasts](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[RequestId] [varchar](50) NOT NULL,
	[CustomerCode] [nvarchar](50) NOT NULL,
	[MaterialCode] [nvarchar](50) NOT NULL,
	[MonthYear] [nchar](6) NULL,
	[AutoCalculateQuantity] [int] NULL,
	[Quantity]  AS ([ForecastQuantity]-[AdjustedQuantity]),
	[ForecastQuantity] [int] NULL,
	[PreviousMonthQuantity] [int] NULL,
	[LastYearQuantity] [int] NULL,
	[AdjustedQuantity] [int] NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[CreatedOn] [datetime] NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[UpdatedOn] [datetime] NULL,
	[CompanyId] [int] NULL,
	[Price] [decimal](18, 2) NULL,
	[Amount] [decimal](18, 2) NULL,
	[WasEdited] [bit] NULL,
 CONSTRAINT [PK_SalesForecasts] PRIMARY KEY CLUSTERED 
(
	[RequestId] ASC,
	[CustomerCode] ASC,
	[MaterialCode] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[SalesOrder]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SalesOrder](
	[SalesOrderId] [int] IDENTITY(1,1) NOT NULL,
	[SONumber] [nvarchar](50) NULL,
	[CustomerCode] [nvarchar](50) NULL,
	[MaterialCode] [nvarchar](50) NULL,
	[OrderQuantity] [decimal](18, 2) NULL,
	[UOM] [nvarchar](50) NULL,
	[OrderDate] [datetime] NULL,
	[Status] [nvarchar](50) NULL,
	[TotalAmount] [nvarchar](50) NULL,
	[Discount] [nvarchar](50) NULL,
	[Tax] [nvarchar](50) NULL,
	[NetAmount] [nvarchar](50) NULL,
	[PaymentMethod] [nvarchar](50) NULL,
	[ShippingAddress] [nvarchar](255) NULL,
	[BillingAddress] [nvarchar](255) NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[CreatedOn] [datetime] NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[UpdatedOn] [datetime] NULL,
	[CompanyId] [int] NULL,
	[IsActive] [bit] NULL,
	[PlannedDispatchDate] [datetime] NULL,
	[ReasonForDateChanged] [nvarchar](50) NULL,
 CONSTRAINT [PK_SalesOrder] PRIMARY KEY CLUSTERED 
(
	[SalesOrderId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[SalesPerson]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SalesPerson](
	[SalesPersonId] [int] NOT NULL,
	[FullName] [nvarchar](50) NULL,
	[EmployeeCode] [nvarchar](20) NULL,
	[Email] [nvarchar](100) NULL,
	[PhoneNumber] [nvarchar](20) NULL,
	[AlternatePhone] [nvarchar](20) NULL,
	[Address] [nvarchar](200) NULL,
	[CityId] [int] NULL,
	[StateId] [int] NULL,
	[CountryId] [int] NULL,
	[PostalCode] [nvarchar](10) NULL,
	[TargetSales] [nvarchar](50) NULL,
	[AchievedSales] [nvarchar](50) NULL,
	[ManagerId] [int] NULL,
	[Designation] [nvarchar](50) NULL,
	[TotalSales] [nvarchar](50) NULL,
	[PerformanceRating] [nvarchar](50) NULL,
	[AnnualBonus] [nvarchar](50) NULL,
	[IsActive] [bit] NULL,
	[CreatedOn] [datetime] NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[UpdatedOn] [datetime] NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[CompanyId] [int] NULL,
 CONSTRAINT [PK_SalesPerson_1] PRIMARY KEY CLUSTERED 
(
	[SalesPersonId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[SalesPersonCustomerMapping]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SalesPersonCustomerMapping](
	[SalesPersonId] [int] NOT NULL,
	[CustomerId] [int] NOT NULL,
	[CustomerCode] [nvarchar](50) NULL,
	[IsActive] [bit] NULL,
	[CreatedBy] [nchar](50) NULL,
	[CreatedDate] [datetime] NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[UpdatedDate] [datetime] NULL,
	[CompanyId] [int] NULL,
 CONSTRAINT [PK_SalesPersonCustomerMapping_1] PRIMARY KEY CLUSTERED 
(
	[SalesPersonId] ASC,
	[CustomerId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[SalesPersonQtyBlocked]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SalesPersonQtyBlocked](
	[ID] [int] IDENTITY(1,1) NOT NULL,
	[SalespersonId] [int] NULL,
	[SalespersonName] [nvarchar](50) NULL,
	[BlockedQunatity] [decimal](18, 2) NULL,
	[MaterialCode] [nvarchar](50) NULL,
	[MaterialName] [nvarchar](50) NULL,
	[CompanyId] [int] NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[UpdatedOn] [datetime] NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[IsReleased] [bit] NULL,
	[CreatedOn] [datetime] NULL,
 CONSTRAINT [PK_SalesPersonQtyBlocked] PRIMARY KEY CLUSTERED 
(
	[ID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[SampleDetails]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SampleDetails](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[CustomerCode] [nvarchar](50) NOT NULL,
	[MaterialCode] [nvarchar](50) NOT NULL,
	[Quantity] [int] NULL,
	[MonthYear] [nvarchar](6) NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[CreatedOn] [datetime] NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[UpdatedOn] [datetime] NULL,
	[CompanyId] [int] NULL,
	[SalesPersonId] [int] NULL,
	[Price] [decimal](18, 2) NULL,
	[Amount] [decimal](18, 2) NULL,
	[SampleSentOn] [datetime] NULL,
 CONSTRAINT [PK_SampleDetails] PRIMARY KEY CLUSTERED 
(
	[CustomerCode] ASC,
	[MaterialCode] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Scrap]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Scrap](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[RequestId] [nvarchar](50) NULL,
	[MaterialCode] [nvarchar](50) NULL,
	[MaterialName] [nvarchar](100) NULL,
	[Quantity] [decimal](18, 2) NULL,
	[ScrapQuantity] [decimal](18, 2) NULL,
	[UOM] [nvarchar](50) NULL,
	[NumberOfBagsScrap] [int] NULL,
	[KGInPerBagsScrap] [decimal](18, 2) NULL,
	[OutputDate] [datetime] NULL,
	[Status] [nvarchar](50) NULL,
	[StoreId] [int] NULL,
	[PackagingType] [nvarchar](50) NULL,
	[QRCodeUrl] [nvarchar](100) NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[CreatedOn] [datetime] NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[UpdatedOn] [datetime] NULL,
	[CompanyId] [int] NULL,
	[BagName] [nvarchar](50) NULL,
	[Color] [nvarchar](50) NULL,
 CONSTRAINT [PK_Scrap] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ScrapDispatch]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ScrapDispatch](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[RequestId] [nvarchar](50) NULL,
	[VehicleNumber] [nvarchar](50) NULL,
	[VehicleType] [nvarchar](50) NULL,
	[NumberOfBags] [nvarchar](50) NULL,
	[TotalQuantity] [decimal](18, 2) NULL,
	[KGInPerBag] [decimal](18, 2) NULL,
	[UOM] [nchar](10) NULL,
	[Status] [nvarchar](50) NULL,
	[DispatchDate] [datetime] NULL,
	[UpdatedBy] [nchar](10) NULL,
	[UpdatedOn] [datetime] NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[CreatedOn] [datetime] NULL,
	[CompanyId] [int] NULL,
	[QRCodeUrl] [nvarchar](100) NULL,
 CONSTRAINT [PK_ScrapDispatch] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[SemiFinishedGood]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SemiFinishedGood](
	[SFGId] [int] IDENTITY(1,1) NOT NULL,
	[RequestId] [nvarchar](50) NULL,
	[MaterialCode] [nvarchar](50) NULL,
	[MaterialName] [nvarchar](100) NULL,
	[Quantity] [decimal](18, 2) NULL,
	[SFGQuantity] [decimal](18, 2) NULL,
	[OutputDate] [datetime] NULL,
	[UOM] [nvarchar](50) NULL,
	[NumberOfBags] [int] NULL,
	[KGInPerBags] [decimal](18, 2) NULL,
	[StoreId] [int] NULL,
	[ToleranceLevelId] [int] NULL,
	[MachineId] [int] NULL,
	[RawMaterialId] [int] NULL,
	[Status] [nvarchar](50) NULL,
	[CreatedBy] [nvarchar](100) NULL,
	[CreatedOn] [datetime] NULL,
	[UpdatedBy] [nvarchar](100) NULL,
	[UpdatedOn] [datetime] NULL,
	[CompanyId] [int] NULL,
	[QRCodeUrl] [nvarchar](500) NULL,
	[BagName] [nvarchar](50) NULL,
	[Color] [nvarchar](50) NULL,
	[ReasonForRepackaging] [nvarchar](50) NULL,
	[RepackDate] [datetime] NULL,
 CONSTRAINT [PK_SemiFinishedGood] PRIMARY KEY CLUSTERED 
(
	[SFGId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ServiceType]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ServiceType](
	[ServiceTypeId] [int] IDENTITY(1,1) NOT NULL,
	[ServiceTypeName] [nvarchar](50) NOT NULL,
	[CompanyId] [int] NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[CreatedOn] [datetime] NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[UpdatedOn] [datetime] NULL,
 CONSTRAINT [PK_ServiceType] PRIMARY KEY CLUSTERED 
(
	[ServiceTypeId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ShiftCalendar]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ShiftCalendar](
	[ShiftCalendarId] [int] IDENTITY(1,1) NOT NULL,
	[Date] [date] NULL,
	[ShiftId] [int] NULL,
	[MachineId] [int] NULL,
	[IsWorkingDay] [bit] NULL,
	[IsHoliday] [bit] NULL,
	[HolidayName] [nvarchar](100) NULL,
	[AvailableHours] [decimal](5, 2) NULL,
	[CustomerId] [int] NOT NULL,
	[DayType] [nvarchar](20) NULL,
	[Remarks] [nvarchar](500) NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[CreatedDate] [datetime2](7) NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[UpdatedDate] [datetime2](7) NULL,
 CONSTRAINT [PK__ShiftCal__53CFC44D1D823F89] PRIMARY KEY CLUSTERED 
(
	[ShiftCalendarId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ShiftMaster]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ShiftMaster](
	[ShiftId] [int] IDENTITY(1,1) NOT NULL,
	[ShiftCode] [nvarchar](20) NOT NULL,
	[ShiftName] [nvarchar](50) NOT NULL,
	[StartTime] [time](7) NOT NULL,
	[EndTime] [time](7) NOT NULL,
	[BreakMinutes] [int] NULL,
	[IsActive] [bit] NOT NULL,
	[CustomerId] [int] NOT NULL,
	[WorkCenterCode] [nvarchar](50) NULL,
	[OperatorCount] [int] NOT NULL,
	[Status] [nvarchar](20) NULL,
	[CreatedBy] [nvarchar](100) NULL,
	[CreatedDate] [datetime2](7) NULL,
	[UpdatedBy] [nvarchar](100) NULL,
	[UpdatedDate] [datetime2](7) NULL,
	[Operators] [nvarchar](max) NULL,
PRIMARY KEY CLUSTERED 
(
	[ShiftId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[SpareType]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SpareType](
	[SpareTypeId] [int] IDENTITY(1,1) NOT NULL,
	[SpareTypeName] [nvarchar](50) NOT NULL,
	[CompanyId] [int] NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[CreatedOn] [datetime] NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[UpdatedOn] [datetime] NULL,
 CONSTRAINT [PK_SpareType] PRIMARY KEY CLUSTERED 
(
	[SpareTypeId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Store]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Store](
	[StoreId] [int] IDENTITY(1,1) NOT NULL,
	[StoreName] [nvarchar](50) NOT NULL,
	[PlantId] [int] NULL,
	[YardId] [int] NULL,
	[LocationId] [int] NULL,
	[StoreManagerId] [int] NULL,
	[InWardManagerId] [int] NULL,
	[ManagerId] [int] NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[CreatedOn] [datetime] NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[UpdatedOn] [datetime] NULL,
	[CompanyId] [int] NULL,
 CONSTRAINT [PK_Store] PRIMARY KEY CLUSTERED 
(
	[StoreId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[TentativeRMPlan]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[TentativeRMPlan](
	[Id] [int] NOT NULL,
	[Segment] [nvarchar](50) NULL,
	[RMGrade] [nvarchar](50) NULL,
	[RequirementInMT] [decimal](18, 2) NULL,
	[StockInHand] [decimal](18, 2) NULL,
	[MinimumStockLevel] [decimal](18, 2) NULL,
	[MaterialInTransit] [decimal](18, 2) NULL,
	[FinalRequirement] [decimal](18, 2) NULL,
	[MonthYear] [nchar](6) NOT NULL,
	[WeekNumber] [int] NOT NULL,
	[CreatedBy] [nvarchar](50) NOT NULL,
	[CreatedOn] [datetime] NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[UpdatedOn] [datetime] NULL,
	[CompanyId] [int] NULL,
 CONSTRAINT [PK_TentativeRMPlan] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ToleranceLevel]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ToleranceLevel](
	[ToleranceLevelId] [int] IDENTITY(1,1) NOT NULL,
	[ToleranceName] [nvarchar](50) NULL,
	[MinValue] [nvarchar](50) NULL,
	[MaxValue] [nvarchar](50) NULL,
	[UnitOfMeasure] [nvarchar](50) NULL,
	[Description] [nvarchar](50) NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[CreatedOn] [datetime] NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[UpdatedOn] [datetime] NULL,
	[CompanyId] [int] NULL,
 CONSTRAINT [PK_ToleranceLevel] PRIMARY KEY CLUSTERED 
(
	[ToleranceLevelId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ToolingMaster]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ToolingMaster](
	[ToolId] [int] IDENTITY(1,1) NOT NULL,
	[ToolCode] [nvarchar](50) NOT NULL,
	[ToolName] [nvarchar](200) NOT NULL,
	[ToolType] [nvarchar](50) NULL,
	[AssignedToMachineCode] [nvarchar](50) NULL,
	[AssignedToMachineId] [int] NULL,
	[LifeUsed] [decimal](10, 2) NULL,
	[LifeTotal] [decimal](10, 2) NULL,
	[LastChangeDate] [datetime2](7) NULL,
	[NextChangeDate] [datetime2](7) NULL,
	[Status] [nvarchar](30) NULL,
	[IsActive] [bit] NOT NULL,
	[CustomerId] [int] NOT NULL,
	[CreatedDate] [datetime2](7) NULL,
	[UpdatedDate] [datetime2](7) NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[CreatedBy] [nvarchar](50) NULL,
PRIMARY KEY CLUSTERED 
(
	[ToolId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[UnPack]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[UnPack](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[RequestId] [nvarchar](50) NULL,
	[MaterialCode] [nvarchar](50) NULL,
	[MaterialName] [nvarchar](50) NULL,
	[Quantity] [decimal](18, 2) NULL,
	[NumberOfBags] [int] NULL,
	[KGInPerBag] [decimal](18, 2) NULL,
	[BagName] [nvarchar](50) NULL,
	[Remarks] [nvarchar](100) NULL,
	[CompanyId] [int] NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[UpdatedOn] [datetime] NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[CreatedOn] [datetime] NULL,
	[UOM] [nchar](10) NULL,
	[Color] [nvarchar](50) NULL,
	[SONumber] [nvarchar](50) NULL,
	[Status] [nvarchar](50) NULL,
	[Date] [datetime] NULL,
 CONSTRAINT [PK_UnPack] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[VehicleDetails]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[VehicleDetails](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[RequestId] [nvarchar](50) NULL,
	[VehicleNumber] [nvarchar](50) NULL,
	[VehicleType] [nvarchar](50) NULL,
	[MaterialCode] [nvarchar](50) NULL,
	[MaterialName] [nvarchar](50) NULL,
	[Status] [nvarchar](50) NULL,
	[LoadQuantity] [decimal](18, 2) NULL,
	[UnloadQuantity] [decimal](18, 2) NULL,
	[LoadedBags] [int] NULL,
	[UnloadedBags] [int] NULL,
	[KGInPerBag] [decimal](18, 2) NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[CreatedOn] [datetime] NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[UpdatedOn] [datetime] NULL,
	[CompanyId] [int] NULL,
	[FGId] [nvarchar](500) NULL,
 CONSTRAINT [PK_VehicleDetails] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Vendors]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Vendors](
	[VendorId] [int] IDENTITY(1,1) NOT NULL,
	[VendorName] [nvarchar](50) NULL,
	[PhoneNumber] [varchar](50) NULL,
	[EmailAddress] [varchar](50) NULL,
	[VendorCode] [varchar](50) NULL,
	[Address] [varchar](200) NULL,
	[VehicleNumber] [varchar](50) NULL,
	[VendorCIN] [varchar](50) NULL,
	[VendorGST] [varchar](50) NULL,
	[CompanyWebsite] [varchar](200) NULL,
	[IsActive] [bit] NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[CreatedOn] [datetime] NULL,
	[UpdatedOn] [datetime] NULL,
	[UpdatedBy] [nchar](10) NULL,
	[PackagingTypeId] [int] NULL,
	[CompanyId] [int] NULL,
 CONSTRAINT [PK_Vendor_1] PRIMARY KEY CLUSTERED 
(
	[VendorId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WeeklyPlanning]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WeeklyPlanning](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[MaterialCode] [nvarchar](50) NOT NULL,
	[MonthYear] [nchar](6) NOT NULL,
	[WeekNumber] [int] NOT NULL,
	[Next10DaysRequirement] [decimal](18, 2) NULL,
	[RequiredProduction] [decimal](18, 2) NULL,
	[QtyInStock] [decimal](18, 2) NULL,
	[PlannedQty] [decimal](18, 2) NOT NULL,
	[CreatedBy] [nvarchar](50) NOT NULL,
	[CreatedOn] [datetime] NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[UpdatedOn] [datetime] NULL,
	[CompanyId] [int] NULL,
 CONSTRAINT [PK_WeeklyPlanning] PRIMARY KEY CLUSTERED 
(
	[MaterialCode] ASC,
	[MonthYear] ASC,
	[WeekNumber] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WeighingMachine]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WeighingMachine](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[FGQuantity] [decimal](18, 2) NULL,
	[SFGQuantity] [decimal](18, 2) NULL,
	[RejectedQuantity] [decimal](18, 2) NULL,
	[ScrapQuantity] [decimal](18, 2) NULL,
	[OnlineHoldQuantity] [decimal](18, 2) NULL,
	[MachineCode] [nvarchar](50) NULL,
	[CreatedOn] [datetime] NULL,
	[IsActive] [bit] NULL,
	[ShiftName] [nvarchar](50) NULL,
	[ShiftStartTime] [datetime] NULL,
	[ShiftEndTime] [datetime] NULL,
 CONSTRAINT [PK_WeighingMachine] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WIPRMRequest]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WIPRMRequest](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[RequestId]  AS ('WIP'+right('0000'+CONVERT([varchar](5),[Id]),(5))),
	[ItemCode] [nvarchar](50) NOT NULL,
	[RequestedQuantity] [decimal](18, 2) NULL,
	[UOM] [nvarchar](50) NULL,
	[ReleasedQuantity] [decimal](18, 2) NULL,
	[ReceivedQuantity] [decimal](18, 2) NULL,
	[StoreId] [int] NULL,
	[StoreName] [nvarchar](10) NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[CreatedOn] [datetime] NULL,
	[UpdatedOn] [datetime] NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[CompanyId] [int] NULL,
	[Status] [nvarchar](50) NULL,
 CONSTRAINT [PK_WIPRMRequest] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WIPStorage]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WIPStorage](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[RequestId]  AS ('WIP'+right('0000'+CONVERT([varchar](5),[Id]),(5))),
	[ParentRequestId] [nvarchar](50) NULL,
	[MachineCode] [nvarchar](50) NULL,
	[RMCode] [nvarchar](50) NULL,
	[RMName] [nvarchar](50) NULL,
	[FGCode] [nvarchar](50) NULL,
	[FGName] [nvarchar](50) NULL,
	[Remarks] [nvarchar](100) NULL,
	[FGQuantity] [decimal](18, 2) NULL,
	[UOM] [nvarchar](50) NULL,
	[RMQuantity] [decimal](18, 2) NULL,
	[InputDate] [datetime] NULL,
	[InputQuantity] [decimal](18, 2) NULL,
	[Status] [nvarchar](255) NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[CreatedOn] [datetime] NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[UpdatedOn] [datetime] NULL,
	[CompanyId] [int] NULL,
	[QRCodeUrl] [nvarchar](500) NULL,
	[FGNumberOfBags] [int] NULL,
	[KGInPerBag] [decimal](18, 2) NULL,
	[SFGQuantity] [decimal](18, 2) NULL,
	[SFGNumberOfBags] [int] NULL,
	[ScrapQuantity] [decimal](18, 2) NULL,
	[ScrapNumberOfBags] [int] NULL,
	[RejectedQuantity] [decimal](18, 2) NULL,
	[RejectedNumberOfBags] [int] NULL,
	[OnlineHoldQuantity] [decimal](18, 2) NULL,
	[OnlineHoldNumberOfBags] [int] NULL,
	[SFGCode] [nvarchar](50) NULL,
	[SFGName] [nvarchar](50) NULL,
	[FinishedQuantity] [decimal](18, 2) NULL,
	[NumberOfBags] [int] NULL,
	[Color] [nvarchar](50) NULL,
	[RMBagName] [nvarchar](50) NULL,
	[CurrentMachineStep] [int] NOT NULL,
	[Machine1Name] [nvarchar](100) NULL,
	[Machine1InputQty] [decimal](18, 2) NULL,
	[Machine1OutputQty] [decimal](18, 2) NULL,
	[Machine2Name] [nvarchar](100) NULL,
	[Machine2InputQty] [decimal](18, 2) NULL,
	[Machine2OutputQty] [decimal](18, 2) NULL,
	[Machine3Name] [nvarchar](100) NULL,
	[Machine3InputQty] [decimal](18, 2) NULL,
	[Machine2Bins] [nvarchar](500) NULL,
	[Machine3Bins] [nvarchar](500) NULL,
	[MachineId] [int] NULL,
	[ItemCode] [nvarchar](100) NULL,
	[RMGradeId] [int] NULL,
	[RequestedQuantity] [decimal](18, 2) NULL,
	[IssuedQuantity] [decimal](18, 2) NULL,
	[IssueDate] [datetime] NULL,
	[RemainingQuantity] [decimal](18, 2) NULL,
	[QuantityInMachine] [decimal](18, 2) NULL,
	[OutputDate] [datetime] NULL,
 CONSTRAINT [PK_WIPStorage] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WIPStorageLocation]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WIPStorageLocation](
	[WIPStorageLocationId] [int] IDENTITY(1,1) NOT NULL,
	[ItemName] [nvarchar](50) NULL,
	[ItemCode] [nvarchar](50) NULL,
	[NumberOfBags] [nvarchar](50) NULL,
	[KGInPerBag] [decimal](18, 2) NULL,
	[ReceivedQuantity] [decimal](18, 2) NULL,
	[ReceivedDate] [datetime] NULL,
	[UOM] [nchar](10) NULL,
	[Remarks] [nvarchar](100) NULL,
	[CompanyId] [int] NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[CreatedOn] [datetime] NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[UpdatedOn] [datetime] NULL,
	[RemainingQuantity] [decimal](18, 2) NULL,
	[BagName] [nvarchar](50) NULL,
	[ProductionPlanningRequestId] [nvarchar](50) NULL,
 CONSTRAINT [PK_WIPStorageLocation] PRIMARY KEY CLUSTERED 
(
	[WIPStorageLocationId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WorkflowActionTemplate]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WorkflowActionTemplate](
	[StepId] [int] NOT NULL,
	[ActionId] [int] NOT NULL,
	[ActionName] [nvarchar](50) NOT NULL,
	[NextStep] [nvarchar](10) NULL,
	[TargetStepId] [int] NULL,
	[NotificationTemplate] [nvarchar](200) NULL,
	[SendNotification] [bit] NULL,
	[CloseWorkflow] [bit] NULL,
	[WarningMessage] [nvarchar](200) NULL,
	[CommentRequired] [bit] NULL,
	[AttachmentRequired] [bit] NULL,
	[AttachmentMandatory] [bit] NULL,
	[WorkflowType] [nvarchar](50) NOT NULL,
 CONSTRAINT [PK_WorkflowActionTemplate_1] PRIMARY KEY CLUSTERED 
(
	[StepId] ASC,
	[ActionId] ASC,
	[ActionName] ASC,
	[WorkflowType] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WorkflowAgentsTemplate]    Script Date: 03-08-2026 09:51:47 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WorkflowAgentsTemplate](
	[StepId] [int] NOT NULL,
	[AgentGroupName] [nvarchar](50) NOT NULL,
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[IsActive] [bit] NULL,
	[SLADays] [int] NULL,
	[WorkflowType] [nvarchar](50) NOT NULL,
 CONSTRAINT [PK_WFAgents] PRIMARY KEY CLUSTERED 
(
	[StepId] ASC,
	[AgentGroupName] ASC,
	[WorkflowType] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WorkflowHistory]    Script Date: 03-08-2026 09:51:48 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WorkflowHistory](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[RequestId] [nvarchar](50) NULL,
	[WorkStepId] [int] NULL,
	[WorkStepName] [nvarchar](50) NULL,
	[WorkStepDescription] [nvarchar](50) NULL,
	[Remarks] [nvarchar](200) NULL,
	[ActionTakenBy] [nvarchar](50) NULL,
	[ActionDate] [datetime] NULL,
	[CurrentStatus] [int] NULL,
	[CurrentStatusName] [nvarchar](50) NULL,
	[ActionName] [nvarchar](50) NULL,
	[ActionComment] [nvarchar](200) NULL,
	[ActionById] [nvarchar](50) NULL,
 CONSTRAINT [PK_WorkflowHistory] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WorkflowStepsTemplate]    Script Date: 03-08-2026 09:51:48 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WorkflowStepsTemplate](
	[StepId] [int] NOT NULL,
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[FormUrl] [nvarchar](100) NULL,
	[StepName] [nvarchar](50) NOT NULL,
	[StepDescription] [nvarchar](200) NULL,
	[Active] [bit] NULL,
	[LocationId] [int] NULL,
	[SLADays] [int] NULL,
	[WorkflowType] [nvarchar](50) NOT NULL,
 CONSTRAINT [PK_WorkflowSteps_1] PRIMARY KEY CLUSTERED 
(
	[StepId] ASC,
	[WorkflowType] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WorkOrder]    Script Date: 03-08-2026 09:51:48 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WorkOrder](
	[WorkOrderId] [int] IDENTITY(1,1) NOT NULL,
	[WorkOrderNumber] [nvarchar](20) NOT NULL,
	[MpsId] [int] NULL,
	[ProductId] [int] NOT NULL,
	[PlannedQty] [decimal](18, 4) NOT NULL,
	[CompletedQty] [decimal](18, 4) NOT NULL,
	[UOM] [nvarchar](10) NULL,
	[DueDate] [datetime2](7) NULL,
	[PriorityId] [int] NULL,
	[RoutingId] [int] NULL,
	[BomId] [int] NULL,
	[MachineId] [int] NULL,
	[OperatorId] [int] NULL,
	[ShiftId] [int] NULL,
	[PlannedStart] [datetime2](7) NULL,
	[PlannedEnd] [datetime2](7) NULL,
	[ActualStart] [datetime2](7) NULL,
	[ActualEnd] [datetime2](7) NULL,
	[PlannedDurationHours] [decimal](10, 2) NULL,
	[ActualDurationHours] [decimal](10, 2) NULL,
	[Status] [nvarchar](20) NOT NULL,
	[CurrentStep] [int] NULL,
	[ProgressPercent] [decimal](5, 2) NULL,
	[HasException] [bit] NOT NULL,
	[ExceptionCount] [int] NOT NULL,
	[CustomerId] [int] NOT NULL,
	[CustomerOrderRef] [nvarchar](50) NULL,
	[BomVersion] [nvarchar](20) NULL,
	[ReleasedDate] [datetime2](7) NULL,
	[ReleasedBy] [nvarchar](100) NULL,
	[CancelReasonCode] [nvarchar](50) NULL,
	[CancelReasonNotes] [nvarchar](max) NULL,
	[CancelledDate] [datetime2](7) NULL,
	[Notes] [nvarchar](max) NULL,
	[CreatedBy] [nvarchar](100) NULL,
	[CreatedDate] [datetime2](7) NULL,
	[UpdatedBy] [nvarchar](100) NULL,
	[UpdatedDate] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[WorkOrderId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WorkOrderBOM]    Script Date: 03-08-2026 09:51:48 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WorkOrderBOM](
	[WorkOrderBOMId] [int] IDENTITY(1,1) NOT NULL,
	[WorkOrderId] [int] NOT NULL,
	[ComponentId] [int] NOT NULL,
	[Quantity] [decimal](18, 4) NOT NULL,
	[UOM] [nvarchar](20) NULL,
	[IssuedQty] [decimal](18, 4) NULL,
	[ConsumedQty] [decimal](18, 4) NULL,
	[ScrapQty] [decimal](18, 4) NULL,
	[Status] [nvarchar](20) NULL,
	[CustomerId] [int] NOT NULL,
	[AllocatedQty] [decimal](18, 4) NULL,
	[RequiredQty] [decimal](18, 4) NULL,
	[ComponentProductId] [int] NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[CreatedDate] [datetime2](7) NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[UpdatedDate] [datetime2](7) NOT NULL,
 CONSTRAINT [PK__WorkOrde__43FE64972920F5DC] PRIMARY KEY CLUSTERED 
(
	[WorkOrderBOMId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WorkOrderChangeLog]    Script Date: 03-08-2026 09:51:48 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WorkOrderChangeLog](
	[ChangeLogId] [int] IDENTITY(1,1) NOT NULL,
	[WorkOrderId] [int] NOT NULL,
	[ChangeType] [nvarchar](50) NOT NULL,
	[FieldChanged] [nvarchar](100) NOT NULL,
	[OldValue] [nvarchar](max) NULL,
	[NewValue] [nvarchar](max) NULL,
	[ChangeReason] [nvarchar](max) NULL,
	[ChangedBy] [nvarchar](100) NOT NULL,
	[ChangedAt] [datetime2](7) NOT NULL,
	[CustomerId] [int] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[ChangeLogId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WorkOrderLog]    Script Date: 03-08-2026 09:51:48 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WorkOrderLog](
	[WorkOrderLogId] [int] IDENTITY(1,1) NOT NULL,
	[WorkOrderId] [int] NOT NULL,
	[EntryType] [nvarchar](20) NOT NULL,
	[Severity] [nvarchar](20) NULL,
	[Title] [nvarchar](200) NOT NULL,
	[Description] [nvarchar](max) NOT NULL,
	[Author] [nvarchar](100) NOT NULL,
	[IsSystemGenerated] [bit] NOT NULL,
	[Timestamp] [datetime2](7) NOT NULL,
	[IsResolved] [bit] NOT NULL,
	[ResolvedAt] [datetime2](7) NULL,
	[ResolvedBy] [nvarchar](100) NULL,
	[ResolutionNote] [nvarchar](max) NULL,
	[AlertId] [int] NULL,
	[CustomerId] [int] NOT NULL,
	[CreatedDate] [datetime2](7) NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[UpdatedDate] [datetime2](7) NULL,
	[UpdatedBy] [nvarchar](50) NULL,
PRIMARY KEY CLUSTERED 
(
	[WorkOrderLogId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WorkOrderResource]    Script Date: 03-08-2026 09:51:48 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WorkOrderResource](
	[WorkOrderResourceId] [int] IDENTITY(1,1) NOT NULL,
	[WorkOrderId] [int] NOT NULL,
	[ResourceType] [nvarchar](20) NOT NULL,
	[ResourceId] [int] NOT NULL,
	[StepSequence] [int] NULL,
	[HoursCommitted] [decimal](10, 2) NULL,
	[Shift] [nvarchar](50) NULL,
	[Status] [nvarchar](20) NOT NULL,
	[CustomerId] [int] NOT NULL,
	[CreatedDate] [datetime2](7) NOT NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[UpdatedDate] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[WorkOrderResourceId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WorkOrderStep]    Script Date: 03-08-2026 09:51:48 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WorkOrderStep](
	[WorkOrderStepId] [int] IDENTITY(1,1) NOT NULL,
	[WorkOrderId] [int] NOT NULL,
	[RoutingStepId] [int] NULL,
	[Sequence] [int] NOT NULL,
	[StepName] [nvarchar](100) NOT NULL,
	[OperationCode] [nvarchar](50) NOT NULL,
	[Status] [nvarchar](20) NOT NULL,
	[WorkcenterId] [int] NULL,
	[OperatorId] [int] NULL,
	[PlannedDurationMins] [decimal](10, 2) NOT NULL,
	[ActualDurationMins] [decimal](10, 2) NOT NULL,
	[PlannedQty] [decimal](18, 4) NOT NULL,
	[CompletedQty] [decimal](18, 4) NOT NULL,
	[ProgressPercent] [decimal](5, 2) NOT NULL,
	[InstructionUrl] [nvarchar](500) NULL,
	[StartedAt] [datetime2](7) NULL,
	[CompletedAt] [datetime2](7) NULL,
	[CustomerId] [int] NOT NULL,
	[CreatedBy] [nvarchar](50) NULL,
	[CreatedDate] [datetime2](7) NULL,
	[UpdatedBy] [nvarchar](50) NULL,
	[UpdatedDate] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[WorkOrderStepId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WorkStepActions]    Script Date: 03-08-2026 09:51:48 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WorkStepActions](
	[WorkStepId] [int] NOT NULL,
	[ActionName] [nvarchar](50) NOT NULL,
	[RequestId] [nvarchar](20) NOT NULL,
	[ActionId] [int] NOT NULL,
	[NotificationTemplate] [nvarchar](200) NULL,
	[TargetStepId] [int] NULL,
	[NextWorkstepId] [int] NULL,
	[SendNotification] [bit] NULL,
	[CloseWorkflow] [bit] NULL,
	[WarningMessage] [nvarchar](200) NULL,
	[CommentRequired] [bit] NULL,
	[AttachmentRequired] [bit] NULL,
	[AttachmentMandatory] [bit] NULL,
 CONSTRAINT [PK_WorkStepActions_1] PRIMARY KEY CLUSTERED 
(
	[WorkStepId] ASC,
	[ActionName] ASC,
	[RequestId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WorkStepAgents]    Script Date: 03-08-2026 09:51:48 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WorkStepAgents](
	[RequestId] [nvarchar](20) NOT NULL,
	[WorkstepId] [int] NOT NULL,
	[AgentGroupName] [nvarchar](50) NOT NULL,
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[SendNotification] [bit] NULL,
	[SLADays] [int] NULL,
 CONSTRAINT [PK_WorkStepAgents] PRIMARY KEY CLUSTERED 
(
	[RequestId] ASC,
	[WorkstepId] ASC,
	[AgentGroupName] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Worksteps]    Script Date: 03-08-2026 09:51:48 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Worksteps](
	[RequestId] [nvarchar](20) NOT NULL,
	[WorkstepId] [int] NOT NULL,
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[ParentRequestId] [nvarchar](20) NULL,
	[WorkstepName] [nvarchar](50) NOT NULL,
	[WorkStepDescription] [nvarchar](50) NULL,
	[InitiationDate] [datetime] NULL,
	[FormUrl] [nvarchar](100) NULL,
	[InitiatorId] [nvarchar](50) NULL,
	[InitiatorName] [nvarchar](50) NULL,
	[IsActive] [bit] NULL,
	[IsComplete] [bit] NULL,
	[Remarks] [nvarchar](200) NULL,
	[ActionDate] [datetime] NULL,
	[ActionBy] [nvarchar](20) NULL,
	[ActionByName] [nvarchar](50) NULL,
	[Action] [nvarchar](50) NULL,
	[CurrentStatus] [int] NULL,
	[CurrentStatusName] [nvarchar](50) NULL,
	[SLADays] [int] NULL,
	[AttachmentIds] [int] NULL,
	[CurrentAction] [nvarchar](50) NULL,
 CONSTRAINT [PK_Worksteps] PRIMARY KEY CLUSTERED 
(
	[RequestId] ASC,
	[WorkstepId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
ALTER TABLE [dbo].[AlertMaster] ADD  DEFAULT ('warning') FOR [Severity]
GO
ALTER TABLE [dbo].[AlertMaster] ADD  DEFAULT ((0)) FOR [IsAcknowledged]
GO
ALTER TABLE [dbo].[AlertMaster] ADD  DEFAULT ((0)) FOR [IsResolved]
GO
ALTER TABLE [dbo].[AlertMaster] ADD  DEFAULT (getutcdate()) FOR [CreatedDate]
GO
ALTER TABLE [dbo].[AlertMaster] ADD  DEFAULT ((1)) FOR [CustomerId]
GO
ALTER TABLE [dbo].[BOMLine] ADD  DEFAULT ((1)) FOR [Quantity]
GO
ALTER TABLE [dbo].[BOMLine] ADD  DEFAULT ('PCS') FOR [UOM]
GO
ALTER TABLE [dbo].[BOMLine] ADD  DEFAULT ((1)) FOR [Sequence]
GO
ALTER TABLE [dbo].[BOMLine] ADD  DEFAULT ((0)) FOR [ScrapPercent]
GO
ALTER TABLE [dbo].[BOMLine] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[BOMLine] ADD  DEFAULT ((1)) FOR [CustomerId]
GO
ALTER TABLE [dbo].[BOMMaster] ADD  DEFAULT ('1.0') FOR [BOMVersion]
GO
ALTER TABLE [dbo].[BOMMaster] ADD  DEFAULT ('Active') FOR [Status]
GO
ALTER TABLE [dbo].[BOMMaster] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[BOMMaster] ADD  DEFAULT ((1)) FOR [CustomerId]
GO
ALTER TABLE [dbo].[BOMMaster] ADD  DEFAULT (getutcdate()) FOR [CreatedDate]
GO
ALTER TABLE [dbo].[CapacityAnalysis] ADD  DEFAULT ((8)) FOR [AvailableHours]
GO
ALTER TABLE [dbo].[CapacityAnalysis] ADD  DEFAULT ((0)) FOR [PlannedHours]
GO
ALTER TABLE [dbo].[CapacityAnalysis] ADD  DEFAULT ((0)) FOR [ActualHours]
GO
ALTER TABLE [dbo].[CapacityAnalysis] ADD  DEFAULT ((0)) FOR [UtilizationPercent]
GO
ALTER TABLE [dbo].[CapacityAnalysis] ADD  DEFAULT ((0)) FOR [OverloadFlag]
GO
ALTER TABLE [dbo].[CapacityAnalysis] ADD  DEFAULT ((1)) FOR [CustomerId]
GO
ALTER TABLE [dbo].[GanttSchedule] ADD  DEFAULT ((0)) FOR [Progress]
GO
ALTER TABLE [dbo].[GanttSchedule] ADD  DEFAULT ((1)) FOR [CustomerId]
GO
ALTER TABLE [dbo].[InventoryByLot] ADD  DEFAULT ((0)) FOR [Quantity]
GO
ALTER TABLE [dbo].[InventoryByLot] ADD  DEFAULT ((0)) FOR [ReservedQty]
GO
ALTER TABLE [dbo].[InventoryByLot] ADD  DEFAULT (getutcdate()) FOR [LastUpdated]
GO
ALTER TABLE [dbo].[InventoryByLot] ADD  DEFAULT ((1)) FOR [CustomerId]
GO
ALTER TABLE [dbo].[LotMaster] ADD  DEFAULT ('Available') FOR [Status]
GO
ALTER TABLE [dbo].[LotMaster] ADD  DEFAULT ((1)) FOR [CustomerId]
GO
ALTER TABLE [dbo].[MachineMaster] ADD  DEFAULT ((8)) FOR [AvailableHoursPerDay]
GO
ALTER TABLE [dbo].[MachineMaster] ADD  DEFAULT ((100)) FOR [EfficiencyPercent]
GO
ALTER TABLE [dbo].[MachineMaster] ADD  DEFAULT ('Available') FOR [Status]
GO
ALTER TABLE [dbo].[MachineMaster] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[MachineMaster] ADD  DEFAULT ((1)) FOR [CustomerId]
GO
ALTER TABLE [dbo].[MachineMaster] ADD  DEFAULT (getutcdate()) FOR [CreatedDate]
GO
ALTER TABLE [dbo].[MaintenanceWindow] ADD  DEFAULT ('Scheduled') FOR [Status]
GO
ALTER TABLE [dbo].[MaintenanceWindow] ADD  DEFAULT ((1)) FOR [CustomerId]
GO
ALTER TABLE [dbo].[MaintenanceWindow] ADD  CONSTRAINT [DF_MaintenanceWindow_AlertType]  DEFAULT ('info') FOR [AlertType]
GO
ALTER TABLE [dbo].[MaintenanceWindow] ADD  CONSTRAINT [DF_MaintenanceWindow_DurationHours]  DEFAULT ((0)) FOR [DurationHours]
GO
ALTER TABLE [dbo].[MPSHeader] ADD  CONSTRAINT [DF__MPSHeader__Statu__08B54D69]  DEFAULT ('Draft') FOR [Status]
GO
ALTER TABLE [dbo].[MPSHeader] ADD  CONSTRAINT [DF__MPSHeader__IsAct__09A971A2]  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[MPSHeader] ADD  CONSTRAINT [DF__MPSHeader__Custo__0A9D95DB]  DEFAULT ((1)) FOR [CustomerId]
GO
ALTER TABLE [dbo].[MPSHeader] ADD  CONSTRAINT [DF__MPSHeader__Creat__0B91BA14]  DEFAULT (getutcdate()) FOR [CreatedDate]
GO
ALTER TABLE [dbo].[MpsMaster] ADD  CONSTRAINT [DF__MpsMaster__Perio__0E6E26BF]  DEFAULT ('Week') FOR [PeriodType]
GO
ALTER TABLE [dbo].[MpsMaster] ADD  CONSTRAINT [DF__MpsMaster__Statu__0F624AF8]  DEFAULT ('Draft') FOR [Status]
GO
ALTER TABLE [dbo].[MpsMaster] ADD  CONSTRAINT [DF__MpsMaster__IsCon__10566F31]  DEFAULT ((0)) FOR [IsConverted]
GO
ALTER TABLE [dbo].[MpsMaster] ADD  CONSTRAINT [DF__MpsMaster__IsAct__114A936A]  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[MpsMaster] ADD  CONSTRAINT [DF__MpsMaster__Custo__123EB7A3]  DEFAULT ((1)) FOR [CustomerId]
GO
ALTER TABLE [dbo].[MpsMaster] ADD  CONSTRAINT [DF__MpsMaster__Creat__1332DBDC]  DEFAULT (getutcdate()) FOR [CreatedDate]
GO
ALTER TABLE [dbo].[MPSRawMaterialRequirement] ADD  DEFAULT ((0)) FOR [AvailableStock]
GO
ALTER TABLE [dbo].[MPSRawMaterialRequirement] ADD  DEFAULT ((0)) FOR [ShortageQty]
GO
ALTER TABLE [dbo].[MPSRawMaterialRequirement] ADD  DEFAULT (getdate()) FOR [CreatedOn]
GO
ALTER TABLE [dbo].[MRP_Demand] ADD  DEFAULT ((1)) FOR [CustomerId]
GO
ALTER TABLE [dbo].[MRP_Result] ADD  DEFAULT ((0)) FOR [IsAccepted]
GO
ALTER TABLE [dbo].[MRP_Result] ADD  DEFAULT ((1)) FOR [CustomerId]
GO
ALTER TABLE [dbo].[MRP_Run] ADD  DEFAULT (getutcdate()) FOR [RunDate]
GO
ALTER TABLE [dbo].[MRP_Run] ADD  DEFAULT ((30)) FOR [PlanningHorizonDays]
GO
ALTER TABLE [dbo].[MRP_Run] ADD  DEFAULT ('Running') FOR [Status]
GO
ALTER TABLE [dbo].[MRP_Run] ADD  DEFAULT ((0)) FOR [TotalDemands]
GO
ALTER TABLE [dbo].[MRP_Run] ADD  DEFAULT ((0)) FOR [TotalSuggestions]
GO
ALTER TABLE [dbo].[MRP_Run] ADD  DEFAULT ((1)) FOR [CustomerId]
GO
ALTER TABLE [dbo].[NotificationRule] ADD  DEFAULT ((1)) FOR [NotifyEmail]
GO
ALTER TABLE [dbo].[NotificationRule] ADD  DEFAULT ((0)) FOR [NotifySMS]
GO
ALTER TABLE [dbo].[NotificationRule] ADD  DEFAULT ((1)) FOR [NotifyInApp]
GO
ALTER TABLE [dbo].[NotificationRule] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[NotificationRule] ADD  DEFAULT ((1)) FOR [CustomerId]
GO
ALTER TABLE [dbo].[OperatorMaster] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[OperatorMaster] ADD  DEFAULT ((1)) FOR [CustomerId]
GO
ALTER TABLE [dbo].[OperatorMaster] ADD  DEFAULT (getutcdate()) FOR [CreatedDate]
GO
ALTER TABLE [dbo].[PriorityMaster] ADD  DEFAULT ((3)) FOR [PriorityLevel]
GO
ALTER TABLE [dbo].[PriorityMaster] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[PriorityMaster] ADD  DEFAULT ((1)) FOR [CustomerId]
GO
ALTER TABLE [dbo].[PriorityMaster] ADD  DEFAULT (getutcdate()) FOR [CreatedDate]
GO
ALTER TABLE [dbo].[ProductMaster] ADD  DEFAULT ('PCS') FOR [UOM]
GO
ALTER TABLE [dbo].[ProductMaster] ADD  DEFAULT ((0)) FOR [LeadTimeDays]
GO
ALTER TABLE [dbo].[ProductMaster] ADD  DEFAULT ((0)) FOR [SafetyStock]
GO
ALTER TABLE [dbo].[ProductMaster] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[ProductMaster] ADD  DEFAULT ((1)) FOR [CustomerId]
GO
ALTER TABLE [dbo].[ProductMaster] ADD  DEFAULT (getutcdate()) FOR [CreatedDate]
GO
ALTER TABLE [dbo].[RoutingMaster] ADD  DEFAULT ('1.0') FOR [Version]
GO
ALTER TABLE [dbo].[RoutingMaster] ADD  DEFAULT ('Active') FOR [Status]
GO
ALTER TABLE [dbo].[RoutingMaster] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[RoutingMaster] ADD  DEFAULT ((1)) FOR [CustomerId]
GO
ALTER TABLE [dbo].[RoutingMaster] ADD  DEFAULT (getutcdate()) FOR [CreatedDate]
GO
ALTER TABLE [dbo].[RoutingStep] ADD  CONSTRAINT [DF__RoutingStep__Seq__2334397B]  DEFAULT ((0)) FOR [Seq]
GO
ALTER TABLE [dbo].[RoutingStep] ADD  CONSTRAINT [DF__RoutingSt__Custo__24285DB4]  DEFAULT ((0)) FOR [CustomerId]
GO
ALTER TABLE [dbo].[ShiftCalendar] ADD  CONSTRAINT [DF__ShiftCale__IsWor__5E8A0973]  DEFAULT ((1)) FOR [IsWorkingDay]
GO
ALTER TABLE [dbo].[ShiftCalendar] ADD  CONSTRAINT [DF__ShiftCale__IsHol__5F7E2DAC]  DEFAULT ((0)) FOR [IsHoliday]
GO
ALTER TABLE [dbo].[ShiftCalendar] ADD  CONSTRAINT [DF__ShiftCale__Custo__607251E5]  DEFAULT ((1)) FOR [CustomerId]
GO
ALTER TABLE [dbo].[ShiftMaster] ADD  DEFAULT ((0)) FOR [BreakMinutes]
GO
ALTER TABLE [dbo].[ShiftMaster] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[ShiftMaster] ADD  DEFAULT ((1)) FOR [CustomerId]
GO
ALTER TABLE [dbo].[ShiftMaster] ADD  CONSTRAINT [DF_ShiftMaster_OperatorCount]  DEFAULT ((0)) FOR [OperatorCount]
GO
ALTER TABLE [dbo].[ShiftMaster] ADD  CONSTRAINT [DF_ShiftMaster_Status]  DEFAULT ('Active') FOR [Status]
GO
ALTER TABLE [dbo].[ShiftMaster] ADD  CONSTRAINT [DF_ShiftMaster_CreatedDate]  DEFAULT (getutcdate()) FOR [CreatedDate]
GO
ALTER TABLE [dbo].[ToolingMaster] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[WorkOrder] ADD  DEFAULT ((0)) FOR [CompletedQty]
GO
ALTER TABLE [dbo].[WorkOrder] ADD  DEFAULT ('PCS') FOR [UOM]
GO
ALTER TABLE [dbo].[WorkOrder] ADD  DEFAULT ('Draft') FOR [Status]
GO
ALTER TABLE [dbo].[WorkOrder] ADD  DEFAULT ((0)) FOR [ProgressPercent]
GO
ALTER TABLE [dbo].[WorkOrder] ADD  DEFAULT ((0)) FOR [HasException]
GO
ALTER TABLE [dbo].[WorkOrder] ADD  DEFAULT ((0)) FOR [ExceptionCount]
GO
ALTER TABLE [dbo].[WorkOrder] ADD  DEFAULT ((1)) FOR [CustomerId]
GO
ALTER TABLE [dbo].[WorkOrder] ADD  DEFAULT (getutcdate()) FOR [CreatedDate]
GO
ALTER TABLE [dbo].[WorkOrderBOM] ADD  CONSTRAINT [DF__WorkOrderBO__UOM__339FAB6E]  DEFAULT ('PCS') FOR [UOM]
GO
ALTER TABLE [dbo].[WorkOrderBOM] ADD  CONSTRAINT [DF__WorkOrder__Issue__3493CFA7]  DEFAULT ((0)) FOR [IssuedQty]
GO
ALTER TABLE [dbo].[WorkOrderBOM] ADD  CONSTRAINT [DF__WorkOrder__Consu__3587F3E0]  DEFAULT ((0)) FOR [ConsumedQty]
GO
ALTER TABLE [dbo].[WorkOrderBOM] ADD  CONSTRAINT [DF__WorkOrder__Scrap__367C1819]  DEFAULT ((0)) FOR [ScrapQty]
GO
ALTER TABLE [dbo].[WorkOrderBOM] ADD  CONSTRAINT [DF__WorkOrder__Statu__37703C52]  DEFAULT ('Pending') FOR [Status]
GO
ALTER TABLE [dbo].[WorkOrderBOM] ADD  CONSTRAINT [DF__WorkOrder__Custo__3864608B]  DEFAULT ((1)) FOR [CustomerId]
GO
ALTER TABLE [dbo].[WorkOrderChangeLog] ADD  DEFAULT (getutcdate()) FOR [ChangedAt]
GO
ALTER TABLE [dbo].[WorkOrderChangeLog] ADD  DEFAULT ((1)) FOR [CustomerId]
GO
ALTER TABLE [dbo].[WorkOrderLog] ADD  DEFAULT ('system_event') FOR [EntryType]
GO
ALTER TABLE [dbo].[WorkOrderLog] ADD  DEFAULT ('System') FOR [Author]
GO
ALTER TABLE [dbo].[WorkOrderLog] ADD  DEFAULT ((1)) FOR [IsSystemGenerated]
GO
ALTER TABLE [dbo].[WorkOrderLog] ADD  DEFAULT (getutcdate()) FOR [Timestamp]
GO
ALTER TABLE [dbo].[WorkOrderLog] ADD  DEFAULT ((0)) FOR [IsResolved]
GO
ALTER TABLE [dbo].[WorkOrderLog] ADD  DEFAULT ((1)) FOR [CustomerId]
GO
ALTER TABLE [dbo].[WorkOrderResource] ADD  DEFAULT ('Assigned') FOR [Status]
GO
ALTER TABLE [dbo].[WorkOrderResource] ADD  DEFAULT ((1)) FOR [CustomerId]
GO
ALTER TABLE [dbo].[WorkOrderResource] ADD  DEFAULT (getutcdate()) FOR [CreatedDate]
GO
ALTER TABLE [dbo].[WorkOrderStep] ADD  DEFAULT ('pending') FOR [Status]
GO
ALTER TABLE [dbo].[WorkOrderStep] ADD  DEFAULT ((0)) FOR [PlannedDurationMins]
GO
ALTER TABLE [dbo].[WorkOrderStep] ADD  DEFAULT ((0)) FOR [ActualDurationMins]
GO
ALTER TABLE [dbo].[WorkOrderStep] ADD  DEFAULT ((0)) FOR [PlannedQty]
GO
ALTER TABLE [dbo].[WorkOrderStep] ADD  DEFAULT ((0)) FOR [CompletedQty]
GO
ALTER TABLE [dbo].[WorkOrderStep] ADD  DEFAULT ((0)) FOR [ProgressPercent]
GO
ALTER TABLE [dbo].[WorkOrderStep] ADD  DEFAULT ((1)) FOR [CustomerId]
GO
ALTER TABLE [dbo].[BOMLine]  WITH CHECK ADD  CONSTRAINT [FK_BOMLine_BOM] FOREIGN KEY([BOMId])
REFERENCES [dbo].[BOMMaster] ([BOMId])
GO
ALTER TABLE [dbo].[BOMLine] CHECK CONSTRAINT [FK_BOMLine_BOM]
GO
ALTER TABLE [dbo].[BOMLine]  WITH CHECK ADD  CONSTRAINT [FK_BOMLine_Component] FOREIGN KEY([ComponentId])
REFERENCES [dbo].[ProductMaster] ([ProductId])
GO
ALTER TABLE [dbo].[BOMLine] CHECK CONSTRAINT [FK_BOMLine_Component]
GO
ALTER TABLE [dbo].[BOMMaster]  WITH CHECK ADD  CONSTRAINT [FK_BOMMaster_Product] FOREIGN KEY([ProductId])
REFERENCES [dbo].[ProductMaster] ([ProductId])
GO
ALTER TABLE [dbo].[BOMMaster] CHECK CONSTRAINT [FK_BOMMaster_Product]
GO
ALTER TABLE [dbo].[GanttSchedule]  WITH CHECK ADD  CONSTRAINT [FK_GanttSchedule_WorkOrder] FOREIGN KEY([WorkOrderId])
REFERENCES [dbo].[WorkOrder] ([WorkOrderId])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[GanttSchedule] CHECK CONSTRAINT [FK_GanttSchedule_WorkOrder]
GO
ALTER TABLE [dbo].[InventoryByLot]  WITH CHECK ADD  CONSTRAINT [FK_InventoryByLot_Lot] FOREIGN KEY([LotId])
REFERENCES [dbo].[LotMaster] ([LotId])
GO
ALTER TABLE [dbo].[InventoryByLot] CHECK CONSTRAINT [FK_InventoryByLot_Lot]
GO
ALTER TABLE [dbo].[InventoryByLot]  WITH CHECK ADD  CONSTRAINT [FK_InventoryByLot_Product] FOREIGN KEY([ProductId])
REFERENCES [dbo].[ProductMaster] ([ProductId])
GO
ALTER TABLE [dbo].[InventoryByLot] CHECK CONSTRAINT [FK_InventoryByLot_Product]
GO
ALTER TABLE [dbo].[LotMaster]  WITH CHECK ADD  CONSTRAINT [FK_LotMaster_Product] FOREIGN KEY([ProductId])
REFERENCES [dbo].[ProductMaster] ([ProductId])
GO
ALTER TABLE [dbo].[LotMaster] CHECK CONSTRAINT [FK_LotMaster_Product]
GO
ALTER TABLE [dbo].[MpsMaster]  WITH CHECK ADD  CONSTRAINT [FK_MpsMaster_Header] FOREIGN KEY([MpsHeaderId])
REFERENCES [dbo].[MPSHeader] ([MpsHeaderId])
GO
ALTER TABLE [dbo].[MpsMaster] CHECK CONSTRAINT [FK_MpsMaster_Header]
GO
ALTER TABLE [dbo].[MpsMaster]  WITH CHECK ADD  CONSTRAINT [FK_MpsMaster_Product] FOREIGN KEY([ProductId])
REFERENCES [dbo].[ProductMaster] ([ProductId])
GO
ALTER TABLE [dbo].[MpsMaster] CHECK CONSTRAINT [FK_MpsMaster_Product]
GO
ALTER TABLE [dbo].[MPSRawMaterialRequirement]  WITH CHECK ADD  CONSTRAINT [FK_MPSRawMaterialRequirement_MPSMaster] FOREIGN KEY([MpsId])
REFERENCES [dbo].[MpsMaster] ([MpsId])
GO
ALTER TABLE [dbo].[MPSRawMaterialRequirement] CHECK CONSTRAINT [FK_MPSRawMaterialRequirement_MPSMaster]
GO
ALTER TABLE [dbo].[MRP_Demand]  WITH CHECK ADD  CONSTRAINT [FK_MRP_Demand_Product] FOREIGN KEY([ProductId])
REFERENCES [dbo].[ProductMaster] ([ProductId])
GO
ALTER TABLE [dbo].[MRP_Demand] CHECK CONSTRAINT [FK_MRP_Demand_Product]
GO
ALTER TABLE [dbo].[MRP_Demand]  WITH CHECK ADD  CONSTRAINT [FK_MRP_Demand_Run] FOREIGN KEY([MrpRunId])
REFERENCES [dbo].[MRP_Run] ([MrpRunId])
GO
ALTER TABLE [dbo].[MRP_Demand] CHECK CONSTRAINT [FK_MRP_Demand_Run]
GO
ALTER TABLE [dbo].[MRP_Result]  WITH CHECK ADD  CONSTRAINT [FK_MRP_Result_Product] FOREIGN KEY([ProductId])
REFERENCES [dbo].[ProductMaster] ([ProductId])
GO
ALTER TABLE [dbo].[MRP_Result] CHECK CONSTRAINT [FK_MRP_Result_Product]
GO
ALTER TABLE [dbo].[MRP_Result]  WITH CHECK ADD  CONSTRAINT [FK_MRP_Result_Run] FOREIGN KEY([MrpRunId])
REFERENCES [dbo].[MRP_Run] ([MrpRunId])
GO
ALTER TABLE [dbo].[MRP_Result] CHECK CONSTRAINT [FK_MRP_Result_Run]
GO
ALTER TABLE [dbo].[RoutingStep]  WITH CHECK ADD  CONSTRAINT [FK_RoutingStep_RoutingTemplate] FOREIGN KEY([RoutingTemplateId])
REFERENCES [dbo].[RoutingTemplate] ([RoutingTemplateId])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[RoutingStep] CHECK CONSTRAINT [FK_RoutingStep_RoutingTemplate]
GO
ALTER TABLE [dbo].[ShiftMaster]  WITH CHECK ADD  CONSTRAINT [FK_ShiftMaster_ShiftMaster] FOREIGN KEY([ShiftId])
REFERENCES [dbo].[ShiftMaster] ([ShiftId])
GO
ALTER TABLE [dbo].[ShiftMaster] CHECK CONSTRAINT [FK_ShiftMaster_ShiftMaster]
GO
ALTER TABLE [dbo].[ToolingMaster]  WITH CHECK ADD  CONSTRAINT [FK_ToolingMaster_Machine] FOREIGN KEY([AssignedToMachineId])
REFERENCES [dbo].[MachineMaster] ([MachineId])
ON DELETE SET NULL
GO
ALTER TABLE [dbo].[ToolingMaster] CHECK CONSTRAINT [FK_ToolingMaster_Machine]
GO
ALTER TABLE [dbo].[WorkOrderBOM]  WITH CHECK ADD  CONSTRAINT [FK_WorkOrderBOM_Component] FOREIGN KEY([ComponentId])
REFERENCES [dbo].[ProductMaster] ([ProductId])
GO
ALTER TABLE [dbo].[WorkOrderBOM] CHECK CONSTRAINT [FK_WorkOrderBOM_Component]
GO
ALTER TABLE [dbo].[WorkOrderBOM]  WITH CHECK ADD  CONSTRAINT [FK_WorkOrderBOM_WorkOrder] FOREIGN KEY([WorkOrderId])
REFERENCES [dbo].[WorkOrder] ([WorkOrderId])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[WorkOrderBOM] CHECK CONSTRAINT [FK_WorkOrderBOM_WorkOrder]
GO
ALTER TABLE [dbo].[WorkOrderLog]  WITH CHECK ADD  CONSTRAINT [FK_WorkOrderLog_WorkOrder] FOREIGN KEY([WorkOrderId])
REFERENCES [dbo].[WorkOrder] ([WorkOrderId])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[WorkOrderLog] CHECK CONSTRAINT [FK_WorkOrderLog_WorkOrder]
GO
ALTER TABLE [dbo].[WorkOrderResource]  WITH CHECK ADD  CONSTRAINT [FK_WorkOrderResource_WorkOrder] FOREIGN KEY([WorkOrderId])
REFERENCES [dbo].[WorkOrder] ([WorkOrderId])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[WorkOrderResource] CHECK CONSTRAINT [FK_WorkOrderResource_WorkOrder]
GO
ALTER TABLE [dbo].[WorkOrderStep]  WITH CHECK ADD  CONSTRAINT [FK_WorkOrderStep_Machine] FOREIGN KEY([WorkcenterId])
REFERENCES [dbo].[MachineMaster] ([MachineId])
GO
ALTER TABLE [dbo].[WorkOrderStep] CHECK CONSTRAINT [FK_WorkOrderStep_Machine]
GO
