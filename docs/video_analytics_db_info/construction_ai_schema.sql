--
-- PostgreSQL database dump
--

\restrict 8Yd0d93qV6dNaX8W03x6SY5CjzPNJcAluhsekrLPw5RxoVEkNu9sPdXWXkSn3WH

-- Dumped from database version 16.14
-- Dumped by pg_dump version 18.4

-- Started on 2026-08-14 11:07:56

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 326 (class 1255 OID 44661)
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 215 (class 1259 OID 44662)
-- Name: access_rules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.access_rules (
    id integer NOT NULL,
    employee_ids json,
    allowed_plant_ids json,
    allowed_department_ids json,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.access_rules OWNER TO postgres;

--
-- TOC entry 216 (class 1259 OID 44668)
-- Name: access_rules_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.access_rules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.access_rules_id_seq OWNER TO postgres;

--
-- TOC entry 5543 (class 0 OID 0)
-- Dependencies: 216
-- Name: access_rules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.access_rules_id_seq OWNED BY public.access_rules.id;


--
-- TOC entry 217 (class 1259 OID 44669)
-- Name: agent_recommendations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.agent_recommendations (
    id integer NOT NULL,
    agent_id character varying(100) NOT NULL,
    category character varying(50) NOT NULL,
    priority character varying(20) NOT NULL,
    title character varying(500) NOT NULL,
    description text NOT NULL,
    zone_id integer,
    camera_id integer,
    is_acknowledged boolean,
    is_dismissed boolean,
    source_data json,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.agent_recommendations OWNER TO postgres;

--
-- TOC entry 218 (class 1259 OID 44675)
-- Name: agent_recommendations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.agent_recommendations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.agent_recommendations_id_seq OWNER TO postgres;

--
-- TOC entry 5544 (class 0 OID 0)
-- Dependencies: 218
-- Name: agent_recommendations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.agent_recommendations_id_seq OWNED BY public.agent_recommendations.id;


--
-- TOC entry 219 (class 1259 OID 44676)
-- Name: ai_model_classes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ai_model_classes (
    id integer NOT NULL,
    model_id integer,
    class_name character varying(255) NOT NULL,
    class_index integer NOT NULL,
    color character varying(50),
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.ai_model_classes OWNER TO postgres;

--
-- TOC entry 220 (class 1259 OID 44680)
-- Name: ai_model_classes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.ai_model_classes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ai_model_classes_id_seq OWNER TO postgres;

--
-- TOC entry 5545 (class 0 OID 0)
-- Dependencies: 220
-- Name: ai_model_classes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ai_model_classes_id_seq OWNED BY public.ai_model_classes.id;


--
-- TOC entry 221 (class 1259 OID 44681)
-- Name: ai_models; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ai_models (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    version character varying(100) NOT NULL,
    framework character varying(100) NOT NULL,
    model_path text NOT NULL,
    trt_engine_path text,
    trt_ready boolean,
    config_path text,
    description text,
    is_active boolean,
    created_at timestamp without time zone DEFAULT now(),
    group_id integer,
    trt_gpu_id integer,
    trt_max_batch integer
);


ALTER TABLE public.ai_models OWNER TO postgres;

--
-- TOC entry 222 (class 1259 OID 44687)
-- Name: ai_models_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.ai_models_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ai_models_id_seq OWNER TO postgres;

--
-- TOC entry 5546 (class 0 OID 0)
-- Dependencies: 222
-- Name: ai_models_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ai_models_id_seq OWNED BY public.ai_models.id;


--
-- TOC entry 223 (class 1259 OID 44688)
-- Name: alerts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.alerts (
    id integer NOT NULL,
    camera_id integer,
    camera_name character varying(255),
    zone_id integer,
    assignment_id integer,
    track_id integer NOT NULL,
    class_name character varying(255) NOT NULL,
    confidence double precision NOT NULL,
    snapshot_path text,
    is_acknowledged boolean,
    created_at timestamp without time zone DEFAULT now(),
    camera_rule_id integer
);


ALTER TABLE public.alerts OWNER TO postgres;

--
-- TOC entry 224 (class 1259 OID 44694)
-- Name: alerts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.alerts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.alerts_id_seq OWNER TO postgres;

--
-- TOC entry 5547 (class 0 OID 0)
-- Dependencies: 224
-- Name: alerts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.alerts_id_seq OWNED BY public.alerts.id;


--
-- TOC entry 225 (class 1259 OID 44695)
-- Name: anomaly_flags; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.anomaly_flags (
    id integer NOT NULL,
    anomaly_type character varying(50) NOT NULL,
    severity character varying(20) NOT NULL,
    description text NOT NULL,
    zone_id integer,
    camera_id integer,
    class_name character varying(255),
    baseline_value double precision,
    observed_value double precision,
    deviation_factor double precision,
    event_count integer,
    window_hours integer,
    is_acknowledged boolean,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.anomaly_flags OWNER TO postgres;

--
-- TOC entry 226 (class 1259 OID 44701)
-- Name: anomaly_flags_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.anomaly_flags_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.anomaly_flags_id_seq OWNER TO postgres;

--
-- TOC entry 5548 (class 0 OID 0)
-- Dependencies: 226
-- Name: anomaly_flags_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.anomaly_flags_id_seq OWNED BY public.anomaly_flags.id;


--
-- TOC entry 227 (class 1259 OID 44702)
-- Name: attendances; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.attendances (
    id integer NOT NULL,
    employee_id character varying(50) NOT NULL,
    "timestamp" timestamp without time zone DEFAULT now(),
    punch_type character varying(50),
    camera_id integer,
    exit_time timestamp without time zone,
    duration_minutes double precision,
    department_name character varying(100),
    entry_snapshot character varying(255),
    exit_snapshot character varying(255),
    is_restricted boolean DEFAULT false
);


ALTER TABLE public.attendances OWNER TO postgres;

--
-- TOC entry 228 (class 1259 OID 44709)
-- Name: attendances_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.attendances_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.attendances_id_seq OWNER TO postgres;

--
-- TOC entry 5549 (class 0 OID 0)
-- Dependencies: 228
-- Name: attendances_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.attendances_id_seq OWNED BY public.attendances.id;


--
-- TOC entry 229 (class 1259 OID 44710)
-- Name: barcode_scans; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.barcode_scans (
    id integer NOT NULL,
    barcode character varying(255) NOT NULL,
    conveyor_id integer,
    batch_id character varying(100),
    scan_timestamp timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.barcode_scans OWNER TO postgres;

--
-- TOC entry 230 (class 1259 OID 44714)
-- Name: barcode_scans_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.barcode_scans_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.barcode_scans_id_seq OWNER TO postgres;

--
-- TOC entry 5550 (class 0 OID 0)
-- Dependencies: 230
-- Name: barcode_scans_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.barcode_scans_id_seq OWNED BY public.barcode_scans.id;


--
-- TOC entry 231 (class 1259 OID 44715)
-- Name: basler_devices; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.basler_devices (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    serial_number character varying(100) NOT NULL,
    model_name character varying(100),
    device_index integer NOT NULL,
    status character varying(20),
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.basler_devices OWNER TO postgres;

--
-- TOC entry 232 (class 1259 OID 44719)
-- Name: basler_devices_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.basler_devices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.basler_devices_id_seq OWNER TO postgres;

--
-- TOC entry 5551 (class 0 OID 0)
-- Dependencies: 232
-- Name: basler_devices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.basler_devices_id_seq OWNED BY public.basler_devices.id;


--
-- TOC entry 233 (class 1259 OID 44720)
-- Name: basler_model_assignments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.basler_model_assignments (
    id integer NOT NULL,
    basler_camera_id integer NOT NULL,
    model_id integer NOT NULL,
    confidence_threshold double precision,
    active boolean,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.basler_model_assignments OWNER TO postgres;

--
-- TOC entry 234 (class 1259 OID 44724)
-- Name: basler_model_assignments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.basler_model_assignments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.basler_model_assignments_id_seq OWNER TO postgres;

--
-- TOC entry 5552 (class 0 OID 0)
-- Dependencies: 234
-- Name: basler_model_assignments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.basler_model_assignments_id_seq OWNED BY public.basler_model_assignments.id;


--
-- TOC entry 235 (class 1259 OID 44725)
-- Name: camera_status_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.camera_status_logs (
    id integer NOT NULL,
    camera_id integer NOT NULL,
    status character varying(50) NOT NULL,
    checked_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.camera_status_logs OWNER TO postgres;

--
-- TOC entry 236 (class 1259 OID 44729)
-- Name: camera_status_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.camera_status_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.camera_status_logs_id_seq OWNER TO postgres;

--
-- TOC entry 5553 (class 0 OID 0)
-- Dependencies: 236
-- Name: camera_status_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.camera_status_logs_id_seq OWNED BY public.camera_status_logs.id;


--
-- TOC entry 237 (class 1259 OID 44730)
-- Name: cameras; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cameras (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    ip character varying(100) NOT NULL,
    port integer NOT NULL,
    camera_number character varying(255) NOT NULL,
    user_id character varying(100) NOT NULL,
    password character varying(100) NOT NULL,
    rtsp_template character varying(500),
    stream_type character varying(100),
    status character varying(50),
    department_id integer,
    use_for_face_recognition boolean DEFAULT false,
    plant_id integer,
    location_id integer
);


ALTER TABLE public.cameras OWNER TO postgres;

--
-- TOC entry 238 (class 1259 OID 44736)
-- Name: cameras_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.cameras_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.cameras_id_seq OWNER TO postgres;

--
-- TOC entry 5554 (class 0 OID 0)
-- Dependencies: 238
-- Name: cameras_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.cameras_id_seq OWNED BY public.cameras.id;


--
-- TOC entry 239 (class 1259 OID 44737)
-- Name: correlated_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.correlated_events (
    id integer NOT NULL,
    camera_id integer,
    zone_id integer,
    classes json NOT NULL,
    alert_ids json,
    risk_score double precision,
    window_minutes integer,
    narrative text,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.correlated_events OWNER TO postgres;

--
-- TOC entry 240 (class 1259 OID 44743)
-- Name: correlated_events_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.correlated_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.correlated_events_id_seq OWNER TO postgres;

--
-- TOC entry 5555 (class 0 OID 0)
-- Dependencies: 240
-- Name: correlated_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.correlated_events_id_seq OWNED BY public.correlated_events.id;


--
-- TOC entry 241 (class 1259 OID 44744)
-- Name: counting_batches; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.counting_batches (
    id integer NOT NULL,
    config_id integer,
    config_name character varying(256),
    daily_batch_number integer DEFAULT 1 NOT NULL,
    start_time timestamp without time zone DEFAULT now() NOT NULL,
    end_time timestamp without time zone,
    count_in integer DEFAULT 0 NOT NULL,
    count_out integer DEFAULT 0 NOT NULL,
    total_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.counting_batches OWNER TO postgres;

--
-- TOC entry 242 (class 1259 OID 44752)
-- Name: counting_batches_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.counting_batches_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.counting_batches_id_seq OWNER TO postgres;

--
-- TOC entry 5556 (class 0 OID 0)
-- Dependencies: 242
-- Name: counting_batches_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.counting_batches_id_seq OWNED BY public.counting_batches.id;


--
-- TOC entry 243 (class 1259 OID 44753)
-- Name: counting_configs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.counting_configs (
    id integer NOT NULL,
    name character varying(256) NOT NULL,
    camera_id integer NOT NULL,
    model_id integer NOT NULL,
    roi_line jsonb DEFAULT '[]'::jsonb NOT NULL,
    selected_classes jsonb DEFAULT '[]'::jsonb NOT NULL,
    direction_in character varying(64) DEFAULT 'IN'::character varying NOT NULL,
    direction_out character varying(64) DEFAULT 'OUT'::character varying NOT NULL,
    is_active boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    counting_mode character varying(32) DEFAULT 'generic'::character varying,
    conveyor_name character varying(256),
    roi_type character varying(16) DEFAULT 'line'::character varying,
    roi_points json DEFAULT '[]'::json,
    enable_batching boolean DEFAULT false,
    batch_idle_timeout integer DEFAULT 30,
    tracking_polygon json DEFAULT '[]'::json
);


ALTER TABLE public.counting_configs OWNER TO postgres;

--
-- TOC entry 244 (class 1259 OID 44771)
-- Name: counting_configs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.counting_configs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.counting_configs_id_seq OWNER TO postgres;

--
-- TOC entry 5557 (class 0 OID 0)
-- Dependencies: 244
-- Name: counting_configs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.counting_configs_id_seq OWNED BY public.counting_configs.id;


--
-- TOC entry 245 (class 1259 OID 44772)
-- Name: counting_recordings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.counting_recordings (
    id integer NOT NULL,
    config_id integer,
    config_name character varying(256),
    batch_id integer,
    recording_type character varying(16),
    folder_date date,
    file_path character varying(512) NOT NULL,
    start_time timestamp without time zone,
    end_time timestamp without time zone,
    duration_seconds integer,
    status character varying(16),
    created_at timestamp without time zone
);


ALTER TABLE public.counting_recordings OWNER TO postgres;

--
-- TOC entry 246 (class 1259 OID 44777)
-- Name: counting_recordings_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.counting_recordings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.counting_recordings_id_seq OWNER TO postgres;

--
-- TOC entry 5558 (class 0 OID 0)
-- Dependencies: 246
-- Name: counting_recordings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.counting_recordings_id_seq OWNED BY public.counting_recordings.id;


--
-- TOC entry 247 (class 1259 OID 44778)
-- Name: counting_snapshots; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.counting_snapshots (
    id integer NOT NULL,
    config_id integer,
    snapshot_date date DEFAULT CURRENT_DATE NOT NULL,
    total_count integer DEFAULT 0 NOT NULL,
    count_in integer DEFAULT 0 NOT NULL,
    count_out integer DEFAULT 0 NOT NULL,
    config_name character varying(256)
);


ALTER TABLE public.counting_snapshots OWNER TO postgres;

--
-- TOC entry 248 (class 1259 OID 44785)
-- Name: counting_snapshots_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.counting_snapshots_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.counting_snapshots_id_seq OWNER TO postgres;

--
-- TOC entry 5559 (class 0 OID 0)
-- Dependencies: 248
-- Name: counting_snapshots_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.counting_snapshots_id_seq OWNED BY public.counting_snapshots.id;


--
-- TOC entry 249 (class 1259 OID 44786)
-- Name: defect_detections; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.defect_detections (
    id integer NOT NULL,
    basler_camera_id integer NOT NULL,
    model_id integer,
    model_name character varying(255),
    class_name character varying(100) NOT NULL,
    confidence double precision NOT NULL,
    bbox json NOT NULL,
    image_path character varying(500),
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.defect_detections OWNER TO postgres;

--
-- TOC entry 250 (class 1259 OID 44792)
-- Name: defect_detections_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.defect_detections_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.defect_detections_id_seq OWNER TO postgres;

--
-- TOC entry 5560 (class 0 OID 0)
-- Dependencies: 250
-- Name: defect_detections_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.defect_detections_id_seq OWNED BY public.defect_detections.id;


--
-- TOC entry 251 (class 1259 OID 44793)
-- Name: department_plant; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.department_plant (
    department_id integer NOT NULL,
    plant_id integer NOT NULL
);


ALTER TABLE public.department_plant OWNER TO postgres;

--
-- TOC entry 252 (class 1259 OID 44796)
-- Name: departments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.departments (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description character varying(255)
);


ALTER TABLE public.departments OWNER TO postgres;

--
-- TOC entry 253 (class 1259 OID 44799)
-- Name: departments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.departments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.departments_id_seq OWNER TO postgres;

--
-- TOC entry 5561 (class 0 OID 0)
-- Dependencies: 253
-- Name: departments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.departments_id_seq OWNED BY public.departments.id;


--
-- TOC entry 254 (class 1259 OID 44800)
-- Name: designations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.designations (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    department_id integer
);


ALTER TABLE public.designations OWNER TO postgres;

--
-- TOC entry 255 (class 1259 OID 44803)
-- Name: designations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.designations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.designations_id_seq OWNER TO postgres;

--
-- TOC entry 5562 (class 0 OID 0)
-- Dependencies: 255
-- Name: designations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.designations_id_seq OWNED BY public.designations.id;


--
-- TOC entry 256 (class 1259 OID 44804)
-- Name: detection_assignments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.detection_assignments (
    id integer NOT NULL,
    camera_id integer NOT NULL,
    zone_id integer,
    model_id integer NOT NULL,
    class_id integer,
    confidence_threshold double precision,
    inference_fps integer,
    alert_enabled boolean,
    is_active boolean,
    label character varying(255),
    description text,
    active_start_time character varying(5),
    active_end_time character varying(5),
    active_days json,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.detection_assignments OWNER TO postgres;

--
-- TOC entry 257 (class 1259 OID 44810)
-- Name: detection_assignments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.detection_assignments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.detection_assignments_id_seq OWNER TO postgres;

--
-- TOC entry 5563 (class 0 OID 0)
-- Dependencies: 257
-- Name: detection_assignments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.detection_assignments_id_seq OWNED BY public.detection_assignments.id;


--
-- TOC entry 258 (class 1259 OID 44811)
-- Name: dispatch_manifests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.dispatch_manifests (
    id integer NOT NULL,
    batch_id character varying(100) NOT NULL,
    product_code character varying(100),
    expected_qty integer NOT NULL,
    verification_status character varying(50),
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.dispatch_manifests OWNER TO postgres;

--
-- TOC entry 259 (class 1259 OID 44815)
-- Name: dispatch_manifests_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.dispatch_manifests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.dispatch_manifests_id_seq OWNER TO postgres;

--
-- TOC entry 5564 (class 0 OID 0)
-- Dependencies: 259
-- Name: dispatch_manifests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.dispatch_manifests_id_seq OWNED BY public.dispatch_manifests.id;


--
-- TOC entry 260 (class 1259 OID 44816)
-- Name: employee_movements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.employee_movements (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    current_location character varying(100) NOT NULL,
    previous_location character varying(100),
    time_in timestamp without time zone DEFAULT now(),
    time_out timestamp without time zone,
    duration_minutes double precision,
    approved_by character varying(100)
);


ALTER TABLE public.employee_movements OWNER TO postgres;

--
-- TOC entry 261 (class 1259 OID 44820)
-- Name: employee_movements_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.employee_movements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.employee_movements_id_seq OWNER TO postgres;

--
-- TOC entry 5565 (class 0 OID 0)
-- Dependencies: 261
-- Name: employee_movements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.employee_movements_id_seq OWNED BY public.employee_movements.id;


--
-- TOC entry 262 (class 1259 OID 44821)
-- Name: employee_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.employee_types (
    id integer NOT NULL,
    type_name character varying(100) NOT NULL,
    description character varying(255)
);


ALTER TABLE public.employee_types OWNER TO postgres;

--
-- TOC entry 263 (class 1259 OID 44824)
-- Name: employee_types_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.employee_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.employee_types_id_seq OWNER TO postgres;

--
-- TOC entry 5566 (class 0 OID 0)
-- Dependencies: 263
-- Name: employee_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.employee_types_id_seq OWNED BY public.employee_types.id;


--
-- TOC entry 264 (class 1259 OID 44825)
-- Name: employees; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.employees (
    id integer NOT NULL,
    employee_id character varying(50) NOT NULL,
    employee_name character varying(100) NOT NULL,
    email character varying(100) NOT NULL,
    department character varying(100),
    date_of_birth character varying(50),
    gender character varying(20),
    contact_no character varying(50),
    face_encoding json,
    created_at timestamp without time zone DEFAULT now(),
    profile_picture text,
    employee_type_id integer,
    plant character varying(100),
    location character varying(100)
);


ALTER TABLE public.employees OWNER TO postgres;

--
-- TOC entry 265 (class 1259 OID 44831)
-- Name: employees_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.employees_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.employees_id_seq OWNER TO postgres;

--
-- TOC entry 5567 (class 0 OID 0)
-- Dependencies: 265
-- Name: employees_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.employees_id_seq OWNED BY public.employees.id;


--
-- TOC entry 266 (class 1259 OID 44832)
-- Name: evaluator_templates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.evaluator_templates (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    base_type character varying(100) NOT NULL,
    preset_config json NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.evaluator_templates OWNER TO postgres;

--
-- TOC entry 267 (class 1259 OID 44838)
-- Name: evaluator_templates_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.evaluator_templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.evaluator_templates_id_seq OWNER TO postgres;

--
-- TOC entry 5568 (class 0 OID 0)
-- Dependencies: 267
-- Name: evaluator_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.evaluator_templates_id_seq OWNED BY public.evaluator_templates.id;


--
-- TOC entry 268 (class 1259 OID 44839)
-- Name: hse_camera_rules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.hse_camera_rules (
    id integer NOT NULL,
    camera_id integer NOT NULL,
    rule_id integer NOT NULL,
    config_override json,
    is_active boolean,
    created_at timestamp without time zone DEFAULT now(),
    zone_id integer
);


ALTER TABLE public.hse_camera_rules OWNER TO postgres;

--
-- TOC entry 269 (class 1259 OID 44845)
-- Name: hse_camera_rules_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.hse_camera_rules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.hse_camera_rules_id_seq OWNER TO postgres;

--
-- TOC entry 5569 (class 0 OID 0)
-- Dependencies: 269
-- Name: hse_camera_rules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.hse_camera_rules_id_seq OWNED BY public.hse_camera_rules.id;


--
-- TOC entry 270 (class 1259 OID 44846)
-- Name: hse_rule_definitions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.hse_rule_definitions (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    group_id integer,
    condition_tree json NOT NULL,
    alert_config json NOT NULL,
    is_template boolean,
    is_active boolean,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.hse_rule_definitions OWNER TO postgres;

--
-- TOC entry 271 (class 1259 OID 44853)
-- Name: hse_rule_definitions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.hse_rule_definitions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.hse_rule_definitions_id_seq OWNER TO postgres;

--
-- TOC entry 5570 (class 0 OID 0)
-- Dependencies: 271
-- Name: hse_rule_definitions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.hse_rule_definitions_id_seq OWNED BY public.hse_rule_definitions.id;


--
-- TOC entry 272 (class 1259 OID 44854)
-- Name: hse_rule_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.hse_rule_events (
    id integer NOT NULL,
    camera_id integer,
    rule_id integer,
    camera_rule_id integer,
    track_id integer,
    triggered_at timestamp without time zone DEFAULT now(),
    severity character varying(50),
    snapshot_path text,
    detail json
);


ALTER TABLE public.hse_rule_events OWNER TO postgres;

--
-- TOC entry 273 (class 1259 OID 44860)
-- Name: hse_rule_events_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.hse_rule_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.hse_rule_events_id_seq OWNER TO postgres;

--
-- TOC entry 5571 (class 0 OID 0)
-- Dependencies: 273
-- Name: hse_rule_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.hse_rule_events_id_seq OWNED BY public.hse_rule_events.id;


--
-- TOC entry 274 (class 1259 OID 44861)
-- Name: incidents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.incidents (
    id integer NOT NULL,
    camera_id integer,
    camera_name character varying(255),
    zone_id integer,
    assignment_id integer,
    track_id integer NOT NULL,
    class_name character varying(255) NOT NULL,
    confidence double precision NOT NULL,
    snapshot_path text,
    video_path text,
    duration_seconds integer,
    last_seen_at timestamp without time zone,
    is_active boolean,
    is_acknowledged boolean,
    is_recurring boolean NOT NULL,
    classification character varying(50),
    escalation_status character varying(50),
    root_cause text,
    started_at timestamp without time zone DEFAULT now(),
    resolved_at timestamp without time zone,
    action_tier character varying DEFAULT 'notify'::character varying,
    operator_id integer
);


ALTER TABLE public.incidents OWNER TO postgres;

--
-- TOC entry 275 (class 1259 OID 44868)
-- Name: incidents_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.incidents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.incidents_id_seq OWNER TO postgres;

--
-- TOC entry 5572 (class 0 OID 0)
-- Dependencies: 275
-- Name: incidents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.incidents_id_seq OWNED BY public.incidents.id;


--
-- TOC entry 276 (class 1259 OID 44869)
-- Name: locations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.locations (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description character varying(255)
);


ALTER TABLE public.locations OWNER TO postgres;

--
-- TOC entry 277 (class 1259 OID 44872)
-- Name: locations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.locations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.locations_id_seq OWNER TO postgres;

--
-- TOC entry 5573 (class 0 OID 0)
-- Dependencies: 277
-- Name: locations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.locations_id_seq OWNED BY public.locations.id;


--
-- TOC entry 278 (class 1259 OID 44873)
-- Name: model_groups; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.model_groups (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.model_groups OWNER TO postgres;

--
-- TOC entry 279 (class 1259 OID 44879)
-- Name: model_groups_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.model_groups_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.model_groups_id_seq OWNER TO postgres;

--
-- TOC entry 5574 (class 0 OID 0)
-- Dependencies: 279
-- Name: model_groups_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.model_groups_id_seq OWNED BY public.model_groups.id;


--
-- TOC entry 280 (class 1259 OID 44880)
-- Name: notification_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notification_logs (
    id integer NOT NULL,
    rule_id integer,
    channel character varying(50) NOT NULL,
    recipient text NOT NULL,
    status character varying(50) NOT NULL,
    response text,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.notification_logs OWNER TO postgres;

--
-- TOC entry 281 (class 1259 OID 44886)
-- Name: notification_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.notification_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notification_logs_id_seq OWNER TO postgres;

--
-- TOC entry 5575 (class 0 OID 0)
-- Dependencies: 281
-- Name: notification_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.notification_logs_id_seq OWNED BY public.notification_logs.id;


--
-- TOC entry 282 (class 1259 OID 44887)
-- Name: notification_rule_recipients; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notification_rule_recipients (
    id integer NOT NULL,
    rule_id integer,
    group_id integer
);


ALTER TABLE public.notification_rule_recipients OWNER TO postgres;

--
-- TOC entry 283 (class 1259 OID 44890)
-- Name: notification_rule_recipients_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.notification_rule_recipients_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notification_rule_recipients_id_seq OWNER TO postgres;

--
-- TOC entry 5576 (class 0 OID 0)
-- Dependencies: 283
-- Name: notification_rule_recipients_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.notification_rule_recipients_id_seq OWNED BY public.notification_rule_recipients.id;


--
-- TOC entry 284 (class 1259 OID 44891)
-- Name: notification_rule_targets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notification_rule_targets (
    id integer NOT NULL,
    rule_id integer,
    camera_id integer,
    zone_id integer,
    model_id integer,
    class_id integer
);


ALTER TABLE public.notification_rule_targets OWNER TO postgres;

--
-- TOC entry 285 (class 1259 OID 44894)
-- Name: notification_rule_targets_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.notification_rule_targets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notification_rule_targets_id_seq OWNER TO postgres;

--
-- TOC entry 5577 (class 0 OID 0)
-- Dependencies: 285
-- Name: notification_rule_targets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.notification_rule_targets_id_seq OWNED BY public.notification_rule_targets.id;


--
-- TOC entry 286 (class 1259 OID 44895)
-- Name: notification_rules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notification_rules (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    template_id integer,
    channels json NOT NULL,
    threshold_count integer,
    cooldown_seconds integer,
    enabled boolean,
    attach_snapshot boolean,
    created_at timestamp without time zone DEFAULT now(),
    event_type character varying(64) DEFAULT 'detection'::character varying
);


ALTER TABLE public.notification_rules OWNER TO postgres;

--
-- TOC entry 287 (class 1259 OID 44902)
-- Name: notification_rules_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.notification_rules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notification_rules_id_seq OWNER TO postgres;

--
-- TOC entry 5578 (class 0 OID 0)
-- Dependencies: 287
-- Name: notification_rules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.notification_rules_id_seq OWNED BY public.notification_rules.id;


--
-- TOC entry 288 (class 1259 OID 44903)
-- Name: notification_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notification_settings (
    id integer NOT NULL,
    smtp_host character varying(255),
    smtp_port integer,
    smtp_username character varying(255),
    smtp_password text,
    smtp_from_email character varying(255),
    smtp_use_tls boolean,
    telegram_bot_token text,
    teams_webhook_url text,
    whatsapp_account_sid text,
    whatsapp_auth_token text,
    whatsapp_from_number character varying(100),
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone
);


ALTER TABLE public.notification_settings OWNER TO postgres;

--
-- TOC entry 289 (class 1259 OID 44909)
-- Name: notification_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.notification_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notification_settings_id_seq OWNER TO postgres;

--
-- TOC entry 5579 (class 0 OID 0)
-- Dependencies: 289
-- Name: notification_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.notification_settings_id_seq OWNED BY public.notification_settings.id;


--
-- TOC entry 290 (class 1259 OID 44910)
-- Name: notification_templates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notification_templates (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    template_type character varying(50) NOT NULL,
    subject text,
    body text NOT NULL,
    is_system boolean,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.notification_templates OWNER TO postgres;

--
-- TOC entry 291 (class 1259 OID 44916)
-- Name: notification_templates_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.notification_templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notification_templates_id_seq OWNER TO postgres;

--
-- TOC entry 5580 (class 0 OID 0)
-- Dependencies: 291
-- Name: notification_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.notification_templates_id_seq OWNED BY public.notification_templates.id;


--
-- TOC entry 292 (class 1259 OID 44917)
-- Name: operator_shift_assignments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.operator_shift_assignments (
    id integer NOT NULL,
    user_id integer NOT NULL,
    camera_id integer,
    shift_id integer NOT NULL,
    assignment_date date NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.operator_shift_assignments OWNER TO postgres;

--
-- TOC entry 293 (class 1259 OID 44921)
-- Name: operator_shift_assignments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.operator_shift_assignments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.operator_shift_assignments_id_seq OWNER TO postgres;

--
-- TOC entry 5581 (class 0 OID 0)
-- Dependencies: 293
-- Name: operator_shift_assignments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.operator_shift_assignments_id_seq OWNED BY public.operator_shift_assignments.id;


--
-- TOC entry 294 (class 1259 OID 44922)
-- Name: patrol_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.patrol_logs (
    id integer NOT NULL,
    guard_id integer NOT NULL,
    checkpoint_name character varying(100) NOT NULL,
    expected_time timestamp without time zone,
    actual_time timestamp without time zone,
    status character varying(50)
);


ALTER TABLE public.patrol_logs OWNER TO postgres;

--
-- TOC entry 295 (class 1259 OID 44925)
-- Name: patrol_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.patrol_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.patrol_logs_id_seq OWNER TO postgres;

--
-- TOC entry 5582 (class 0 OID 0)
-- Dependencies: 295
-- Name: patrol_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.patrol_logs_id_seq OWNED BY public.patrol_logs.id;


--
-- TOC entry 296 (class 1259 OID 44926)
-- Name: plants; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.plants (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description character varying(255),
    location_id integer
);


ALTER TABLE public.plants OWNER TO postgres;

--
-- TOC entry 297 (class 1259 OID 44929)
-- Name: plants_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.plants_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.plants_id_seq OWNER TO postgres;

--
-- TOC entry 5583 (class 0 OID 0)
-- Dependencies: 297
-- Name: plants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.plants_id_seq OWNED BY public.plants.id;


--
-- TOC entry 298 (class 1259 OID 44930)
-- Name: recipient_groups; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.recipient_groups (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.recipient_groups OWNER TO postgres;

--
-- TOC entry 299 (class 1259 OID 44936)
-- Name: recipient_groups_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.recipient_groups_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.recipient_groups_id_seq OWNER TO postgres;

--
-- TOC entry 5584 (class 0 OID 0)
-- Dependencies: 299
-- Name: recipient_groups_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.recipient_groups_id_seq OWNED BY public.recipient_groups.id;


--
-- TOC entry 300 (class 1259 OID 44937)
-- Name: recipients; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.recipients (
    id integer NOT NULL,
    group_id integer,
    channel character varying(50) NOT NULL,
    recipient text NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.recipients OWNER TO postgres;

--
-- TOC entry 301 (class 1259 OID 44943)
-- Name: recipients_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.recipients_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.recipients_id_seq OWNER TO postgres;

--
-- TOC entry 5585 (class 0 OID 0)
-- Dependencies: 301
-- Name: recipients_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.recipients_id_seq OWNED BY public.recipients.id;


--
-- TOC entry 302 (class 1259 OID 44944)
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.role_permissions (
    id integer NOT NULL,
    role_id integer NOT NULL,
    component character varying(100) NOT NULL
);


ALTER TABLE public.role_permissions OWNER TO postgres;

--
-- TOC entry 303 (class 1259 OID 44947)
-- Name: role_permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.role_permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.role_permissions_id_seq OWNER TO postgres;

--
-- TOC entry 5586 (class 0 OID 0)
-- Dependencies: 303
-- Name: role_permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.role_permissions_id_seq OWNED BY public.role_permissions.id;


--
-- TOC entry 304 (class 1259 OID 44948)
-- Name: roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.roles (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    mobile_access boolean DEFAULT false
);


ALTER TABLE public.roles OWNER TO postgres;

--
-- TOC entry 305 (class 1259 OID 44952)
-- Name: roles_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.roles_id_seq OWNER TO postgres;

--
-- TOC entry 5587 (class 0 OID 0)
-- Dependencies: 305
-- Name: roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.roles_id_seq OWNED BY public.roles.id;


--
-- TOC entry 306 (class 1259 OID 44953)
-- Name: scheduled_reports; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.scheduled_reports (
    id integer NOT NULL,
    channels json,
    email_recipients json,
    telegram_chat_ids json,
    teams_webhook_url character varying(500),
    whatsapp_numbers json,
    frequency character varying(20) NOT NULL,
    day_of_week integer,
    day_of_month integer,
    send_time character varying(5) NOT NULL,
    format character varying(10) NOT NULL,
    date_range character varying(20) NOT NULL,
    class_name character varying(255),
    camera_id integer,
    zone_id integer,
    is_active boolean,
    created_at timestamp without time zone DEFAULT now(),
    last_sent_at timestamp without time zone
);


ALTER TABLE public.scheduled_reports OWNER TO postgres;

--
-- TOC entry 307 (class 1259 OID 44959)
-- Name: scheduled_reports_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.scheduled_reports_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.scheduled_reports_id_seq OWNER TO postgres;

--
-- TOC entry 5588 (class 0 OID 0)
-- Dependencies: 307
-- Name: scheduled_reports_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.scheduled_reports_id_seq OWNED BY public.scheduled_reports.id;


--
-- TOC entry 308 (class 1259 OID 44960)
-- Name: security_guards; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.security_guards (
    id integer NOT NULL,
    guard_id character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    shift character varying(50),
    assigned_patrol_area character varying(255),
    face_encoding json,
    mobile_device character varying(100),
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.security_guards OWNER TO postgres;

--
-- TOC entry 309 (class 1259 OID 44966)
-- Name: security_guards_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.security_guards_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.security_guards_id_seq OWNER TO postgres;

--
-- TOC entry 5589 (class 0 OID 0)
-- Dependencies: 309
-- Name: security_guards_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.security_guards_id_seq OWNED BY public.security_guards.id;


--
-- TOC entry 310 (class 1259 OID 44967)
-- Name: shifts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.shifts (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    start_time character varying(5) NOT NULL,
    end_time character varying(5) NOT NULL,
    is_active boolean
);


ALTER TABLE public.shifts OWNER TO postgres;

--
-- TOC entry 311 (class 1259 OID 44970)
-- Name: shifts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.shifts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.shifts_id_seq OWNER TO postgres;

--
-- TOC entry 5590 (class 0 OID 0)
-- Dependencies: 311
-- Name: shifts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.shifts_id_seq OWNED BY public.shifts.id;


--
-- TOC entry 312 (class 1259 OID 44971)
-- Name: supervisor_overrides; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.supervisor_overrides (
    id integer NOT NULL,
    incident_id integer NOT NULL,
    operator_id integer,
    supervisor_id integer NOT NULL,
    reason_code character varying(100) NOT NULL,
    video_clip_path text,
    "timestamp" timestamp without time zone DEFAULT now()
);


ALTER TABLE public.supervisor_overrides OWNER TO postgres;

--
-- TOC entry 313 (class 1259 OID 44977)
-- Name: supervisor_overrides_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.supervisor_overrides_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.supervisor_overrides_id_seq OWNER TO postgres;

--
-- TOC entry 5591 (class 0 OID 0)
-- Dependencies: 313
-- Name: supervisor_overrides_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.supervisor_overrides_id_seq OWNED BY public.supervisor_overrides.id;


--
-- TOC entry 314 (class 1259 OID 44978)
-- Name: system_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.system_settings (
    id integer NOT NULL,
    archive_days character varying(50),
    auto_delete_low_severity boolean,
    storage_location character varying(50),
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone,
    session_timeout character varying(50) DEFAULT '60'::character varying,
    enforce_2fa boolean DEFAULT false,
    api_token_expiry character varying(50) DEFAULT '30'::character varying,
    ip_allowlist text DEFAULT ''::text
);


ALTER TABLE public.system_settings OWNER TO postgres;

--
-- TOC entry 315 (class 1259 OID 44988)
-- Name: system_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.system_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.system_settings_id_seq OWNER TO postgres;

--
-- TOC entry 5592 (class 0 OID 0)
-- Dependencies: 315
-- Name: system_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.system_settings_id_seq OWNED BY public.system_settings.id;


--
-- TOC entry 316 (class 1259 OID 44989)
-- Name: user_activity_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_activity_logs (
    id integer NOT NULL,
    user_id integer,
    action character varying(100) NOT NULL,
    detail text,
    ip_address character varying(45),
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.user_activity_logs OWNER TO postgres;

--
-- TOC entry 317 (class 1259 OID 44995)
-- Name: user_activity_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_activity_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_activity_logs_id_seq OWNER TO postgres;

--
-- TOC entry 5593 (class 0 OID 0)
-- Dependencies: 317
-- Name: user_activity_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_activity_logs_id_seq OWNED BY public.user_activity_logs.id;


--
-- TOC entry 318 (class 1259 OID 44996)
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    full_name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    username character varying(255) NOT NULL,
    password_hash text NOT NULL,
    role_id integer NOT NULL,
    is_active boolean,
    created_at timestamp without time zone DEFAULT now(),
    department_id integer,
    designation_id integer,
    phone character varying(20),
    employee_id character varying(50),
    last_login timestamp without time zone,
    expo_push_token character varying(255)
);


ALTER TABLE public.users OWNER TO postgres;

--
-- TOC entry 319 (class 1259 OID 45002)
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- TOC entry 5594 (class 0 OID 0)
-- Dependencies: 319
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- TOC entry 320 (class 1259 OID 45003)
-- Name: visitors; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.visitors (
    id integer NOT NULL,
    visitor_name character varying(100) NOT NULL,
    company character varying(100),
    mobile character varying(50),
    id_proof character varying(100),
    host_employee_id integer,
    department character varying(100),
    entry_time timestamp without time zone,
    exit_time timestamp without time zone,
    photo text,
    plant character varying(100),
    location character varying(100)
);


ALTER TABLE public.visitors OWNER TO postgres;

--
-- TOC entry 321 (class 1259 OID 45008)
-- Name: visitors_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.visitors_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.visitors_id_seq OWNER TO postgres;

--
-- TOC entry 5595 (class 0 OID 0)
-- Dependencies: 321
-- Name: visitors_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.visitors_id_seq OWNED BY public.visitors.id;


--
-- TOC entry 322 (class 1259 OID 45009)
-- Name: zone_risk_scores; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.zone_risk_scores (
    id integer NOT NULL,
    zone_id integer,
    camera_id integer,
    risk_score double precision NOT NULL,
    risk_level character varying(20) NOT NULL,
    event_count integer,
    high_severity_count integer,
    recurrence_count integer,
    top_class character varying(255),
    factors json,
    window_hours integer,
    computed_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.zone_risk_scores OWNER TO postgres;

--
-- TOC entry 323 (class 1259 OID 45015)
-- Name: zone_risk_scores_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.zone_risk_scores_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.zone_risk_scores_id_seq OWNER TO postgres;

--
-- TOC entry 5596 (class 0 OID 0)
-- Dependencies: 323
-- Name: zone_risk_scores_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.zone_risk_scores_id_seq OWNED BY public.zone_risk_scores.id;


--
-- TOC entry 324 (class 1259 OID 45016)
-- Name: zones; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.zones (
    id integer NOT NULL,
    camera_id integer NOT NULL,
    name character varying(255) NOT NULL,
    zone_type character varying(50),
    coordinates json NOT NULL,
    description text,
    is_active boolean NOT NULL,
    active_start_time character varying(5),
    active_end_time character varying(5),
    active_days json,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.zones OWNER TO postgres;

--
-- TOC entry 325 (class 1259 OID 45022)
-- Name: zones_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.zones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.zones_id_seq OWNER TO postgres;

--
-- TOC entry 5597 (class 0 OID 0)
-- Dependencies: 325
-- Name: zones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.zones_id_seq OWNED BY public.zones.id;


--
-- TOC entry 5010 (class 2604 OID 45023)
-- Name: access_rules id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.access_rules ALTER COLUMN id SET DEFAULT nextval('public.access_rules_id_seq'::regclass);


--
-- TOC entry 5012 (class 2604 OID 45024)
-- Name: agent_recommendations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agent_recommendations ALTER COLUMN id SET DEFAULT nextval('public.agent_recommendations_id_seq'::regclass);


--
-- TOC entry 5014 (class 2604 OID 45025)
-- Name: ai_model_classes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_model_classes ALTER COLUMN id SET DEFAULT nextval('public.ai_model_classes_id_seq'::regclass);


--
-- TOC entry 5016 (class 2604 OID 45026)
-- Name: ai_models id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_models ALTER COLUMN id SET DEFAULT nextval('public.ai_models_id_seq'::regclass);


--
-- TOC entry 5018 (class 2604 OID 45027)
-- Name: alerts id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alerts ALTER COLUMN id SET DEFAULT nextval('public.alerts_id_seq'::regclass);


--
-- TOC entry 5020 (class 2604 OID 45028)
-- Name: anomaly_flags id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.anomaly_flags ALTER COLUMN id SET DEFAULT nextval('public.anomaly_flags_id_seq'::regclass);


--
-- TOC entry 5022 (class 2604 OID 45029)
-- Name: attendances id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendances ALTER COLUMN id SET DEFAULT nextval('public.attendances_id_seq'::regclass);


--
-- TOC entry 5025 (class 2604 OID 45030)
-- Name: barcode_scans id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.barcode_scans ALTER COLUMN id SET DEFAULT nextval('public.barcode_scans_id_seq'::regclass);


--
-- TOC entry 5027 (class 2604 OID 45031)
-- Name: basler_devices id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.basler_devices ALTER COLUMN id SET DEFAULT nextval('public.basler_devices_id_seq'::regclass);


--
-- TOC entry 5029 (class 2604 OID 45032)
-- Name: basler_model_assignments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.basler_model_assignments ALTER COLUMN id SET DEFAULT nextval('public.basler_model_assignments_id_seq'::regclass);


--
-- TOC entry 5031 (class 2604 OID 45033)
-- Name: camera_status_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.camera_status_logs ALTER COLUMN id SET DEFAULT nextval('public.camera_status_logs_id_seq'::regclass);


--
-- TOC entry 5033 (class 2604 OID 45034)
-- Name: cameras id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cameras ALTER COLUMN id SET DEFAULT nextval('public.cameras_id_seq'::regclass);


--
-- TOC entry 5035 (class 2604 OID 45035)
-- Name: correlated_events id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.correlated_events ALTER COLUMN id SET DEFAULT nextval('public.correlated_events_id_seq'::regclass);


--
-- TOC entry 5037 (class 2604 OID 45036)
-- Name: counting_batches id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.counting_batches ALTER COLUMN id SET DEFAULT nextval('public.counting_batches_id_seq'::regclass);


--
-- TOC entry 5043 (class 2604 OID 45037)
-- Name: counting_configs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.counting_configs ALTER COLUMN id SET DEFAULT nextval('public.counting_configs_id_seq'::regclass);


--
-- TOC entry 5057 (class 2604 OID 45038)
-- Name: counting_recordings id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.counting_recordings ALTER COLUMN id SET DEFAULT nextval('public.counting_recordings_id_seq'::regclass);


--
-- TOC entry 5058 (class 2604 OID 45039)
-- Name: counting_snapshots id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.counting_snapshots ALTER COLUMN id SET DEFAULT nextval('public.counting_snapshots_id_seq'::regclass);


--
-- TOC entry 5063 (class 2604 OID 45040)
-- Name: defect_detections id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.defect_detections ALTER COLUMN id SET DEFAULT nextval('public.defect_detections_id_seq'::regclass);


--
-- TOC entry 5065 (class 2604 OID 45041)
-- Name: departments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.departments ALTER COLUMN id SET DEFAULT nextval('public.departments_id_seq'::regclass);


--
-- TOC entry 5066 (class 2604 OID 45042)
-- Name: designations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.designations ALTER COLUMN id SET DEFAULT nextval('public.designations_id_seq'::regclass);


--
-- TOC entry 5067 (class 2604 OID 45043)
-- Name: detection_assignments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.detection_assignments ALTER COLUMN id SET DEFAULT nextval('public.detection_assignments_id_seq'::regclass);


--
-- TOC entry 5069 (class 2604 OID 45044)
-- Name: dispatch_manifests id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispatch_manifests ALTER COLUMN id SET DEFAULT nextval('public.dispatch_manifests_id_seq'::regclass);


--
-- TOC entry 5071 (class 2604 OID 45045)
-- Name: employee_movements id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_movements ALTER COLUMN id SET DEFAULT nextval('public.employee_movements_id_seq'::regclass);


--
-- TOC entry 5073 (class 2604 OID 45046)
-- Name: employee_types id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_types ALTER COLUMN id SET DEFAULT nextval('public.employee_types_id_seq'::regclass);


--
-- TOC entry 5074 (class 2604 OID 45047)
-- Name: employees id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees ALTER COLUMN id SET DEFAULT nextval('public.employees_id_seq'::regclass);


--
-- TOC entry 5076 (class 2604 OID 45048)
-- Name: evaluator_templates id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evaluator_templates ALTER COLUMN id SET DEFAULT nextval('public.evaluator_templates_id_seq'::regclass);


--
-- TOC entry 5078 (class 2604 OID 45049)
-- Name: hse_camera_rules id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hse_camera_rules ALTER COLUMN id SET DEFAULT nextval('public.hse_camera_rules_id_seq'::regclass);


--
-- TOC entry 5080 (class 2604 OID 45050)
-- Name: hse_rule_definitions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hse_rule_definitions ALTER COLUMN id SET DEFAULT nextval('public.hse_rule_definitions_id_seq'::regclass);


--
-- TOC entry 5083 (class 2604 OID 45051)
-- Name: hse_rule_events id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hse_rule_events ALTER COLUMN id SET DEFAULT nextval('public.hse_rule_events_id_seq'::regclass);


--
-- TOC entry 5085 (class 2604 OID 45052)
-- Name: incidents id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.incidents ALTER COLUMN id SET DEFAULT nextval('public.incidents_id_seq'::regclass);


--
-- TOC entry 5088 (class 2604 OID 45053)
-- Name: locations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.locations ALTER COLUMN id SET DEFAULT nextval('public.locations_id_seq'::regclass);


--
-- TOC entry 5089 (class 2604 OID 45054)
-- Name: model_groups id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.model_groups ALTER COLUMN id SET DEFAULT nextval('public.model_groups_id_seq'::regclass);


--
-- TOC entry 5091 (class 2604 OID 45055)
-- Name: notification_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_logs ALTER COLUMN id SET DEFAULT nextval('public.notification_logs_id_seq'::regclass);


--
-- TOC entry 5093 (class 2604 OID 45056)
-- Name: notification_rule_recipients id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_rule_recipients ALTER COLUMN id SET DEFAULT nextval('public.notification_rule_recipients_id_seq'::regclass);


--
-- TOC entry 5094 (class 2604 OID 45057)
-- Name: notification_rule_targets id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_rule_targets ALTER COLUMN id SET DEFAULT nextval('public.notification_rule_targets_id_seq'::regclass);


--
-- TOC entry 5095 (class 2604 OID 45058)
-- Name: notification_rules id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_rules ALTER COLUMN id SET DEFAULT nextval('public.notification_rules_id_seq'::regclass);


--
-- TOC entry 5098 (class 2604 OID 45059)
-- Name: notification_settings id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_settings ALTER COLUMN id SET DEFAULT nextval('public.notification_settings_id_seq'::regclass);


--
-- TOC entry 5100 (class 2604 OID 45060)
-- Name: notification_templates id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_templates ALTER COLUMN id SET DEFAULT nextval('public.notification_templates_id_seq'::regclass);


--
-- TOC entry 5102 (class 2604 OID 45061)
-- Name: operator_shift_assignments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.operator_shift_assignments ALTER COLUMN id SET DEFAULT nextval('public.operator_shift_assignments_id_seq'::regclass);


--
-- TOC entry 5104 (class 2604 OID 45062)
-- Name: patrol_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.patrol_logs ALTER COLUMN id SET DEFAULT nextval('public.patrol_logs_id_seq'::regclass);


--
-- TOC entry 5105 (class 2604 OID 45063)
-- Name: plants id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.plants ALTER COLUMN id SET DEFAULT nextval('public.plants_id_seq'::regclass);


--
-- TOC entry 5106 (class 2604 OID 45064)
-- Name: recipient_groups id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recipient_groups ALTER COLUMN id SET DEFAULT nextval('public.recipient_groups_id_seq'::regclass);


--
-- TOC entry 5108 (class 2604 OID 45065)
-- Name: recipients id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recipients ALTER COLUMN id SET DEFAULT nextval('public.recipients_id_seq'::regclass);


--
-- TOC entry 5110 (class 2604 OID 45066)
-- Name: role_permissions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions ALTER COLUMN id SET DEFAULT nextval('public.role_permissions_id_seq'::regclass);


--
-- TOC entry 5111 (class 2604 OID 45067)
-- Name: roles id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_id_seq'::regclass);


--
-- TOC entry 5113 (class 2604 OID 45068)
-- Name: scheduled_reports id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scheduled_reports ALTER COLUMN id SET DEFAULT nextval('public.scheduled_reports_id_seq'::regclass);


--
-- TOC entry 5115 (class 2604 OID 45069)
-- Name: security_guards id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.security_guards ALTER COLUMN id SET DEFAULT nextval('public.security_guards_id_seq'::regclass);


--
-- TOC entry 5117 (class 2604 OID 45070)
-- Name: shifts id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shifts ALTER COLUMN id SET DEFAULT nextval('public.shifts_id_seq'::regclass);


--
-- TOC entry 5118 (class 2604 OID 45071)
-- Name: supervisor_overrides id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supervisor_overrides ALTER COLUMN id SET DEFAULT nextval('public.supervisor_overrides_id_seq'::regclass);


--
-- TOC entry 5120 (class 2604 OID 45072)
-- Name: system_settings id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_settings ALTER COLUMN id SET DEFAULT nextval('public.system_settings_id_seq'::regclass);


--
-- TOC entry 5126 (class 2604 OID 45073)
-- Name: user_activity_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_activity_logs ALTER COLUMN id SET DEFAULT nextval('public.user_activity_logs_id_seq'::regclass);


--
-- TOC entry 5128 (class 2604 OID 45074)
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- TOC entry 5130 (class 2604 OID 45075)
-- Name: visitors id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.visitors ALTER COLUMN id SET DEFAULT nextval('public.visitors_id_seq'::regclass);


--
-- TOC entry 5131 (class 2604 OID 45076)
-- Name: zone_risk_scores id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.zone_risk_scores ALTER COLUMN id SET DEFAULT nextval('public.zone_risk_scores_id_seq'::regclass);


--
-- TOC entry 5133 (class 2604 OID 45077)
-- Name: zones id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.zones ALTER COLUMN id SET DEFAULT nextval('public.zones_id_seq'::regclass);


--
-- TOC entry 5136 (class 2606 OID 45721)
-- Name: access_rules access_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.access_rules
    ADD CONSTRAINT access_rules_pkey PRIMARY KEY (id);


--
-- TOC entry 5138 (class 2606 OID 45723)
-- Name: agent_recommendations agent_recommendations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agent_recommendations
    ADD CONSTRAINT agent_recommendations_pkey PRIMARY KEY (id);


--
-- TOC entry 5141 (class 2606 OID 45725)
-- Name: ai_model_classes ai_model_classes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_model_classes
    ADD CONSTRAINT ai_model_classes_pkey PRIMARY KEY (id);


--
-- TOC entry 5143 (class 2606 OID 45727)
-- Name: ai_models ai_models_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_models
    ADD CONSTRAINT ai_models_pkey PRIMARY KEY (id);


--
-- TOC entry 5146 (class 2606 OID 45729)
-- Name: alerts alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_pkey PRIMARY KEY (id);


--
-- TOC entry 5148 (class 2606 OID 45731)
-- Name: anomaly_flags anomaly_flags_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.anomaly_flags
    ADD CONSTRAINT anomaly_flags_pkey PRIMARY KEY (id);


--
-- TOC entry 5151 (class 2606 OID 45733)
-- Name: attendances attendances_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendances
    ADD CONSTRAINT attendances_pkey PRIMARY KEY (id);


--
-- TOC entry 5155 (class 2606 OID 45735)
-- Name: barcode_scans barcode_scans_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.barcode_scans
    ADD CONSTRAINT barcode_scans_pkey PRIMARY KEY (id);


--
-- TOC entry 5160 (class 2606 OID 45737)
-- Name: basler_devices basler_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.basler_devices
    ADD CONSTRAINT basler_devices_pkey PRIMARY KEY (id);


--
-- TOC entry 5162 (class 2606 OID 45739)
-- Name: basler_devices basler_devices_serial_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.basler_devices
    ADD CONSTRAINT basler_devices_serial_number_key UNIQUE (serial_number);


--
-- TOC entry 5165 (class 2606 OID 45741)
-- Name: basler_model_assignments basler_model_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.basler_model_assignments
    ADD CONSTRAINT basler_model_assignments_pkey PRIMARY KEY (id);


--
-- TOC entry 5168 (class 2606 OID 45743)
-- Name: camera_status_logs camera_status_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.camera_status_logs
    ADD CONSTRAINT camera_status_logs_pkey PRIMARY KEY (id);


--
-- TOC entry 5172 (class 2606 OID 45745)
-- Name: cameras cameras_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cameras
    ADD CONSTRAINT cameras_pkey PRIMARY KEY (id);


--
-- TOC entry 5175 (class 2606 OID 45747)
-- Name: correlated_events correlated_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.correlated_events
    ADD CONSTRAINT correlated_events_pkey PRIMARY KEY (id);


--
-- TOC entry 5179 (class 2606 OID 45749)
-- Name: counting_batches counting_batches_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.counting_batches
    ADD CONSTRAINT counting_batches_pkey PRIMARY KEY (id);


--
-- TOC entry 5183 (class 2606 OID 45751)
-- Name: counting_configs counting_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.counting_configs
    ADD CONSTRAINT counting_configs_pkey PRIMARY KEY (id);


--
-- TOC entry 5185 (class 2606 OID 45753)
-- Name: counting_recordings counting_recordings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.counting_recordings
    ADD CONSTRAINT counting_recordings_pkey PRIMARY KEY (id);


--
-- TOC entry 5189 (class 2606 OID 45755)
-- Name: counting_snapshots counting_snapshots_config_id_snapshot_date_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.counting_snapshots
    ADD CONSTRAINT counting_snapshots_config_id_snapshot_date_key UNIQUE (config_id, snapshot_date);


--
-- TOC entry 5191 (class 2606 OID 45757)
-- Name: counting_snapshots counting_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.counting_snapshots
    ADD CONSTRAINT counting_snapshots_pkey PRIMARY KEY (id);


--
-- TOC entry 5195 (class 2606 OID 45759)
-- Name: defect_detections defect_detections_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.defect_detections
    ADD CONSTRAINT defect_detections_pkey PRIMARY KEY (id);


--
-- TOC entry 5198 (class 2606 OID 45761)
-- Name: department_plant department_plant_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.department_plant
    ADD CONSTRAINT department_plant_pkey PRIMARY KEY (department_id, plant_id);


--
-- TOC entry 5200 (class 2606 OID 45763)
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- TOC entry 5204 (class 2606 OID 45765)
-- Name: designations designations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.designations
    ADD CONSTRAINT designations_pkey PRIMARY KEY (id);


--
-- TOC entry 5206 (class 2606 OID 45767)
-- Name: detection_assignments detection_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.detection_assignments
    ADD CONSTRAINT detection_assignments_pkey PRIMARY KEY (id);


--
-- TOC entry 5208 (class 2606 OID 45769)
-- Name: dispatch_manifests dispatch_manifests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispatch_manifests
    ADD CONSTRAINT dispatch_manifests_pkey PRIMARY KEY (id);


--
-- TOC entry 5212 (class 2606 OID 45771)
-- Name: employee_movements employee_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_movements
    ADD CONSTRAINT employee_movements_pkey PRIMARY KEY (id);


--
-- TOC entry 5216 (class 2606 OID 45773)
-- Name: employee_types employee_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_types
    ADD CONSTRAINT employee_types_pkey PRIMARY KEY (id);


--
-- TOC entry 5218 (class 2606 OID 45775)
-- Name: employee_types employee_types_type_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_types
    ADD CONSTRAINT employee_types_type_name_key UNIQUE (type_name);


--
-- TOC entry 5220 (class 2606 OID 45777)
-- Name: employees employees_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_email_key UNIQUE (email);


--
-- TOC entry 5222 (class 2606 OID 45779)
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);


--
-- TOC entry 5226 (class 2606 OID 45781)
-- Name: evaluator_templates evaluator_templates_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evaluator_templates
    ADD CONSTRAINT evaluator_templates_name_key UNIQUE (name);


--
-- TOC entry 5228 (class 2606 OID 45783)
-- Name: evaluator_templates evaluator_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evaluator_templates
    ADD CONSTRAINT evaluator_templates_pkey PRIMARY KEY (id);


--
-- TOC entry 5231 (class 2606 OID 45785)
-- Name: hse_camera_rules hse_camera_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hse_camera_rules
    ADD CONSTRAINT hse_camera_rules_pkey PRIMARY KEY (id);


--
-- TOC entry 5236 (class 2606 OID 45787)
-- Name: hse_rule_definitions hse_rule_definitions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hse_rule_definitions
    ADD CONSTRAINT hse_rule_definitions_pkey PRIMARY KEY (id);


--
-- TOC entry 5239 (class 2606 OID 45789)
-- Name: hse_rule_events hse_rule_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hse_rule_events
    ADD CONSTRAINT hse_rule_events_pkey PRIMARY KEY (id);


--
-- TOC entry 5246 (class 2606 OID 45791)
-- Name: incidents incidents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.incidents
    ADD CONSTRAINT incidents_pkey PRIMARY KEY (id);


--
-- TOC entry 5248 (class 2606 OID 45793)
-- Name: locations locations_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_name_key UNIQUE (name);


--
-- TOC entry 5250 (class 2606 OID 45795)
-- Name: locations locations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_pkey PRIMARY KEY (id);


--
-- TOC entry 5253 (class 2606 OID 45797)
-- Name: model_groups model_groups_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.model_groups
    ADD CONSTRAINT model_groups_name_key UNIQUE (name);


--
-- TOC entry 5255 (class 2606 OID 45799)
-- Name: model_groups model_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.model_groups
    ADD CONSTRAINT model_groups_pkey PRIMARY KEY (id);


--
-- TOC entry 5257 (class 2606 OID 45801)
-- Name: notification_logs notification_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_logs
    ADD CONSTRAINT notification_logs_pkey PRIMARY KEY (id);


--
-- TOC entry 5259 (class 2606 OID 45803)
-- Name: notification_rule_recipients notification_rule_recipients_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_rule_recipients
    ADD CONSTRAINT notification_rule_recipients_pkey PRIMARY KEY (id);


--
-- TOC entry 5261 (class 2606 OID 45805)
-- Name: notification_rule_targets notification_rule_targets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_rule_targets
    ADD CONSTRAINT notification_rule_targets_pkey PRIMARY KEY (id);


--
-- TOC entry 5263 (class 2606 OID 45807)
-- Name: notification_rules notification_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_rules
    ADD CONSTRAINT notification_rules_pkey PRIMARY KEY (id);


--
-- TOC entry 5265 (class 2606 OID 45809)
-- Name: notification_settings notification_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_settings
    ADD CONSTRAINT notification_settings_pkey PRIMARY KEY (id);


--
-- TOC entry 5267 (class 2606 OID 45811)
-- Name: notification_templates notification_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_templates
    ADD CONSTRAINT notification_templates_pkey PRIMARY KEY (id);


--
-- TOC entry 5270 (class 2606 OID 45813)
-- Name: operator_shift_assignments operator_shift_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.operator_shift_assignments
    ADD CONSTRAINT operator_shift_assignments_pkey PRIMARY KEY (id);


--
-- TOC entry 5273 (class 2606 OID 45815)
-- Name: patrol_logs patrol_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.patrol_logs
    ADD CONSTRAINT patrol_logs_pkey PRIMARY KEY (id);


--
-- TOC entry 5275 (class 2606 OID 45817)
-- Name: plants plants_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.plants
    ADD CONSTRAINT plants_name_key UNIQUE (name);


--
-- TOC entry 5277 (class 2606 OID 45819)
-- Name: plants plants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.plants
    ADD CONSTRAINT plants_pkey PRIMARY KEY (id);


--
-- TOC entry 5279 (class 2606 OID 45821)
-- Name: recipient_groups recipient_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recipient_groups
    ADD CONSTRAINT recipient_groups_pkey PRIMARY KEY (id);


--
-- TOC entry 5281 (class 2606 OID 45823)
-- Name: recipients recipients_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recipients
    ADD CONSTRAINT recipients_pkey PRIMARY KEY (id);


--
-- TOC entry 5283 (class 2606 OID 45825)
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (id);


--
-- TOC entry 5285 (class 2606 OID 45827)
-- Name: roles roles_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_name_key UNIQUE (name);


--
-- TOC entry 5287 (class 2606 OID 45829)
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- TOC entry 5289 (class 2606 OID 45831)
-- Name: scheduled_reports scheduled_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scheduled_reports
    ADD CONSTRAINT scheduled_reports_pkey PRIMARY KEY (id);


--
-- TOC entry 5293 (class 2606 OID 45833)
-- Name: security_guards security_guards_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.security_guards
    ADD CONSTRAINT security_guards_pkey PRIMARY KEY (id);


--
-- TOC entry 5296 (class 2606 OID 45835)
-- Name: shifts shifts_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT shifts_name_key UNIQUE (name);


--
-- TOC entry 5298 (class 2606 OID 45837)
-- Name: shifts shifts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT shifts_pkey PRIMARY KEY (id);


--
-- TOC entry 5301 (class 2606 OID 45839)
-- Name: supervisor_overrides supervisor_overrides_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supervisor_overrides
    ADD CONSTRAINT supervisor_overrides_pkey PRIMARY KEY (id);


--
-- TOC entry 5303 (class 2606 OID 45841)
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (id);


--
-- TOC entry 5202 (class 2606 OID 45843)
-- Name: departments uq_department_name; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT uq_department_name UNIQUE (name);


--
-- TOC entry 5305 (class 2606 OID 45845)
-- Name: user_activity_logs user_activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_activity_logs
    ADD CONSTRAINT user_activity_logs_pkey PRIMARY KEY (id);


--
-- TOC entry 5308 (class 2606 OID 45847)
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- TOC entry 5310 (class 2606 OID 45849)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 5312 (class 2606 OID 45851)
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- TOC entry 5315 (class 2606 OID 45853)
-- Name: visitors visitors_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.visitors
    ADD CONSTRAINT visitors_pkey PRIMARY KEY (id);


--
-- TOC entry 5320 (class 2606 OID 45855)
-- Name: zone_risk_scores zone_risk_scores_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.zone_risk_scores
    ADD CONSTRAINT zone_risk_scores_pkey PRIMARY KEY (id);


--
-- TOC entry 5322 (class 2606 OID 45857)
-- Name: zones zones_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.zones
    ADD CONSTRAINT zones_pkey PRIMARY KEY (id);


--
-- TOC entry 5180 (class 1259 OID 45858)
-- Name: idx_counting_batches_config; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_counting_batches_config ON public.counting_batches USING btree (config_id);


--
-- TOC entry 5181 (class 1259 OID 45859)
-- Name: idx_counting_batches_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_counting_batches_date ON public.counting_batches USING btree (date(start_time));


--
-- TOC entry 5192 (class 1259 OID 45860)
-- Name: idx_counting_snapshots_config; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_counting_snapshots_config ON public.counting_snapshots USING btree (config_id);


--
-- TOC entry 5193 (class 1259 OID 45861)
-- Name: idx_counting_snapshots_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_counting_snapshots_date ON public.counting_snapshots USING btree (snapshot_date);


--
-- TOC entry 5244 (class 1259 OID 45862)
-- Name: idx_incident_lookup; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_incident_lookup ON public.incidents USING btree (camera_id, track_id, class_name, is_active);


--
-- TOC entry 5139 (class 1259 OID 45863)
-- Name: ix_agent_recommendations_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_agent_recommendations_id ON public.agent_recommendations USING btree (id);


--
-- TOC entry 5144 (class 1259 OID 45864)
-- Name: ix_ai_models_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_ai_models_id ON public.ai_models USING btree (id);


--
-- TOC entry 5149 (class 1259 OID 45865)
-- Name: ix_anomaly_flags_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_anomaly_flags_id ON public.anomaly_flags USING btree (id);


--
-- TOC entry 5152 (class 1259 OID 45866)
-- Name: ix_attendances_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_attendances_id ON public.attendances USING btree (id);


--
-- TOC entry 5153 (class 1259 OID 45867)
-- Name: ix_attendances_timestamp; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_attendances_timestamp ON public.attendances USING btree ("timestamp");


--
-- TOC entry 5156 (class 1259 OID 45868)
-- Name: ix_barcode_scans_barcode; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_barcode_scans_barcode ON public.barcode_scans USING btree (barcode);


--
-- TOC entry 5157 (class 1259 OID 45869)
-- Name: ix_barcode_scans_batch_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_barcode_scans_batch_id ON public.barcode_scans USING btree (batch_id);


--
-- TOC entry 5158 (class 1259 OID 45870)
-- Name: ix_barcode_scans_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_barcode_scans_id ON public.barcode_scans USING btree (id);


--
-- TOC entry 5163 (class 1259 OID 45871)
-- Name: ix_basler_devices_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_basler_devices_id ON public.basler_devices USING btree (id);


--
-- TOC entry 5166 (class 1259 OID 45872)
-- Name: ix_basler_model_assignments_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_basler_model_assignments_id ON public.basler_model_assignments USING btree (id);


--
-- TOC entry 5169 (class 1259 OID 45873)
-- Name: ix_camera_status_logs_camera_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_camera_status_logs_camera_id ON public.camera_status_logs USING btree (camera_id);


--
-- TOC entry 5170 (class 1259 OID 45874)
-- Name: ix_camera_status_logs_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_camera_status_logs_id ON public.camera_status_logs USING btree (id);


--
-- TOC entry 5173 (class 1259 OID 45875)
-- Name: ix_cameras_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_cameras_id ON public.cameras USING btree (id);


--
-- TOC entry 5176 (class 1259 OID 45876)
-- Name: ix_correlated_events_camera_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_correlated_events_camera_id ON public.correlated_events USING btree (camera_id);


--
-- TOC entry 5177 (class 1259 OID 45877)
-- Name: ix_correlated_events_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_correlated_events_id ON public.correlated_events USING btree (id);


--
-- TOC entry 5186 (class 1259 OID 45878)
-- Name: ix_counting_recordings_folder_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_counting_recordings_folder_date ON public.counting_recordings USING btree (folder_date);


--
-- TOC entry 5187 (class 1259 OID 45879)
-- Name: ix_counting_recordings_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_counting_recordings_id ON public.counting_recordings USING btree (id);


--
-- TOC entry 5196 (class 1259 OID 45880)
-- Name: ix_defect_detections_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_defect_detections_id ON public.defect_detections USING btree (id);


--
-- TOC entry 5209 (class 1259 OID 45881)
-- Name: ix_dispatch_manifests_batch_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ix_dispatch_manifests_batch_id ON public.dispatch_manifests USING btree (batch_id);


--
-- TOC entry 5210 (class 1259 OID 45882)
-- Name: ix_dispatch_manifests_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_dispatch_manifests_id ON public.dispatch_manifests USING btree (id);


--
-- TOC entry 5213 (class 1259 OID 45883)
-- Name: ix_employee_movements_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_employee_movements_id ON public.employee_movements USING btree (id);


--
-- TOC entry 5214 (class 1259 OID 45884)
-- Name: ix_employee_movements_time_in; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_employee_movements_time_in ON public.employee_movements USING btree (time_in);


--
-- TOC entry 5223 (class 1259 OID 45885)
-- Name: ix_employees_employee_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ix_employees_employee_id ON public.employees USING btree (employee_id);


--
-- TOC entry 5224 (class 1259 OID 45886)
-- Name: ix_employees_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_employees_id ON public.employees USING btree (id);


--
-- TOC entry 5229 (class 1259 OID 45887)
-- Name: ix_evaluator_templates_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_evaluator_templates_id ON public.evaluator_templates USING btree (id);


--
-- TOC entry 5232 (class 1259 OID 45888)
-- Name: ix_hse_camera_rules_camera_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_hse_camera_rules_camera_id ON public.hse_camera_rules USING btree (camera_id);


--
-- TOC entry 5233 (class 1259 OID 45889)
-- Name: ix_hse_camera_rules_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_hse_camera_rules_id ON public.hse_camera_rules USING btree (id);


--
-- TOC entry 5234 (class 1259 OID 45890)
-- Name: ix_hse_camera_rules_zone_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_hse_camera_rules_zone_id ON public.hse_camera_rules USING btree (zone_id);


--
-- TOC entry 5237 (class 1259 OID 45891)
-- Name: ix_hse_rule_definitions_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_hse_rule_definitions_id ON public.hse_rule_definitions USING btree (id);


--
-- TOC entry 5240 (class 1259 OID 45892)
-- Name: ix_hse_rule_events_camera_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_hse_rule_events_camera_id ON public.hse_rule_events USING btree (camera_id);


--
-- TOC entry 5241 (class 1259 OID 45893)
-- Name: ix_hse_rule_events_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_hse_rule_events_id ON public.hse_rule_events USING btree (id);


--
-- TOC entry 5242 (class 1259 OID 45894)
-- Name: ix_hse_rule_events_rule_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_hse_rule_events_rule_id ON public.hse_rule_events USING btree (rule_id);


--
-- TOC entry 5243 (class 1259 OID 45895)
-- Name: ix_hse_rule_events_triggered_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_hse_rule_events_triggered_at ON public.hse_rule_events USING btree (triggered_at);


--
-- TOC entry 5251 (class 1259 OID 45896)
-- Name: ix_model_groups_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_model_groups_id ON public.model_groups USING btree (id);


--
-- TOC entry 5268 (class 1259 OID 45897)
-- Name: ix_operator_shift_assignments_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_operator_shift_assignments_id ON public.operator_shift_assignments USING btree (id);


--
-- TOC entry 5271 (class 1259 OID 45898)
-- Name: ix_patrol_logs_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_patrol_logs_id ON public.patrol_logs USING btree (id);


--
-- TOC entry 5290 (class 1259 OID 45899)
-- Name: ix_security_guards_guard_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ix_security_guards_guard_id ON public.security_guards USING btree (guard_id);


--
-- TOC entry 5291 (class 1259 OID 45900)
-- Name: ix_security_guards_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_security_guards_id ON public.security_guards USING btree (id);


--
-- TOC entry 5294 (class 1259 OID 45901)
-- Name: ix_shifts_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_shifts_id ON public.shifts USING btree (id);


--
-- TOC entry 5299 (class 1259 OID 45902)
-- Name: ix_supervisor_overrides_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_supervisor_overrides_id ON public.supervisor_overrides USING btree (id);


--
-- TOC entry 5306 (class 1259 OID 45903)
-- Name: ix_users_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_users_id ON public.users USING btree (id);


--
-- TOC entry 5313 (class 1259 OID 45904)
-- Name: ix_visitors_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_visitors_id ON public.visitors USING btree (id);


--
-- TOC entry 5316 (class 1259 OID 45905)
-- Name: ix_zone_risk_scores_camera_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_zone_risk_scores_camera_id ON public.zone_risk_scores USING btree (camera_id);


--
-- TOC entry 5317 (class 1259 OID 45906)
-- Name: ix_zone_risk_scores_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_zone_risk_scores_id ON public.zone_risk_scores USING btree (id);


--
-- TOC entry 5318 (class 1259 OID 45907)
-- Name: ix_zone_risk_scores_zone_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_zone_risk_scores_zone_id ON public.zone_risk_scores USING btree (zone_id);


--
-- TOC entry 5394 (class 2620 OID 45908)
-- Name: counting_configs set_counting_configs_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_counting_configs_updated_at BEFORE UPDATE ON public.counting_configs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5323 (class 2606 OID 45909)
-- Name: agent_recommendations agent_recommendations_camera_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agent_recommendations
    ADD CONSTRAINT agent_recommendations_camera_id_fkey FOREIGN KEY (camera_id) REFERENCES public.cameras(id) ON DELETE SET NULL;


--
-- TOC entry 5324 (class 2606 OID 45914)
-- Name: agent_recommendations agent_recommendations_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agent_recommendations
    ADD CONSTRAINT agent_recommendations_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.zones(id) ON DELETE SET NULL;


--
-- TOC entry 5325 (class 2606 OID 45919)
-- Name: ai_model_classes ai_model_classes_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_model_classes
    ADD CONSTRAINT ai_model_classes_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.ai_models(id);


--
-- TOC entry 5326 (class 2606 OID 45924)
-- Name: ai_models ai_models_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_models
    ADD CONSTRAINT ai_models_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.model_groups(id) ON DELETE SET NULL;


--
-- TOC entry 5327 (class 2606 OID 45929)
-- Name: alerts alerts_assignment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES public.detection_assignments(id) ON DELETE SET NULL;


--
-- TOC entry 5328 (class 2606 OID 45934)
-- Name: alerts alerts_camera_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_camera_id_fkey FOREIGN KEY (camera_id) REFERENCES public.cameras(id);


--
-- TOC entry 5329 (class 2606 OID 45939)
-- Name: alerts alerts_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.zones(id);


--
-- TOC entry 5330 (class 2606 OID 45944)
-- Name: anomaly_flags anomaly_flags_camera_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.anomaly_flags
    ADD CONSTRAINT anomaly_flags_camera_id_fkey FOREIGN KEY (camera_id) REFERENCES public.cameras(id) ON DELETE SET NULL;


--
-- TOC entry 5331 (class 2606 OID 45949)
-- Name: anomaly_flags anomaly_flags_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.anomaly_flags
    ADD CONSTRAINT anomaly_flags_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.zones(id) ON DELETE SET NULL;


--
-- TOC entry 5332 (class 2606 OID 45954)
-- Name: attendances attendances_camera_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendances
    ADD CONSTRAINT attendances_camera_id_fkey FOREIGN KEY (camera_id) REFERENCES public.cameras(id) ON DELETE SET NULL;


--
-- TOC entry 5333 (class 2606 OID 45959)
-- Name: attendances attendances_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendances
    ADD CONSTRAINT attendances_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(employee_id) ON DELETE CASCADE;


--
-- TOC entry 5334 (class 2606 OID 45964)
-- Name: basler_model_assignments basler_model_assignments_basler_camera_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.basler_model_assignments
    ADD CONSTRAINT basler_model_assignments_basler_camera_id_fkey FOREIGN KEY (basler_camera_id) REFERENCES public.basler_devices(id) ON DELETE CASCADE;


--
-- TOC entry 5335 (class 2606 OID 45969)
-- Name: basler_model_assignments basler_model_assignments_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.basler_model_assignments
    ADD CONSTRAINT basler_model_assignments_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.ai_models(id) ON DELETE CASCADE;


--
-- TOC entry 5336 (class 2606 OID 45974)
-- Name: camera_status_logs camera_status_logs_camera_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.camera_status_logs
    ADD CONSTRAINT camera_status_logs_camera_id_fkey FOREIGN KEY (camera_id) REFERENCES public.cameras(id) ON DELETE CASCADE;


--
-- TOC entry 5337 (class 2606 OID 45979)
-- Name: cameras cameras_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cameras
    ADD CONSTRAINT cameras_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- TOC entry 5338 (class 2606 OID 45984)
-- Name: cameras cameras_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cameras
    ADD CONSTRAINT cameras_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE SET NULL;


--
-- TOC entry 5339 (class 2606 OID 45989)
-- Name: cameras cameras_plant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cameras
    ADD CONSTRAINT cameras_plant_id_fkey FOREIGN KEY (plant_id) REFERENCES public.plants(id) ON DELETE SET NULL;


--
-- TOC entry 5340 (class 2606 OID 45994)
-- Name: correlated_events correlated_events_camera_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.correlated_events
    ADD CONSTRAINT correlated_events_camera_id_fkey FOREIGN KEY (camera_id) REFERENCES public.cameras(id) ON DELETE SET NULL;


--
-- TOC entry 5341 (class 2606 OID 45999)
-- Name: correlated_events correlated_events_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.correlated_events
    ADD CONSTRAINT correlated_events_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.zones(id) ON DELETE SET NULL;


--
-- TOC entry 5342 (class 2606 OID 46004)
-- Name: counting_batches counting_batches_config_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.counting_batches
    ADD CONSTRAINT counting_batches_config_id_fkey FOREIGN KEY (config_id) REFERENCES public.counting_configs(id) ON DELETE SET NULL;


--
-- TOC entry 5343 (class 2606 OID 46009)
-- Name: counting_configs counting_configs_camera_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.counting_configs
    ADD CONSTRAINT counting_configs_camera_id_fkey FOREIGN KEY (camera_id) REFERENCES public.cameras(id) ON DELETE CASCADE;


--
-- TOC entry 5344 (class 2606 OID 46014)
-- Name: counting_configs counting_configs_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.counting_configs
    ADD CONSTRAINT counting_configs_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.ai_models(id) ON DELETE CASCADE;


--
-- TOC entry 5345 (class 2606 OID 46019)
-- Name: counting_recordings counting_recordings_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.counting_recordings
    ADD CONSTRAINT counting_recordings_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.counting_batches(id);


--
-- TOC entry 5346 (class 2606 OID 46024)
-- Name: counting_recordings counting_recordings_config_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.counting_recordings
    ADD CONSTRAINT counting_recordings_config_id_fkey FOREIGN KEY (config_id) REFERENCES public.counting_configs(id) ON DELETE SET NULL;


--
-- TOC entry 5347 (class 2606 OID 46029)
-- Name: counting_snapshots counting_snapshots_config_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.counting_snapshots
    ADD CONSTRAINT counting_snapshots_config_id_fkey FOREIGN KEY (config_id) REFERENCES public.counting_configs(id) ON DELETE SET NULL;


--
-- TOC entry 5348 (class 2606 OID 46034)
-- Name: defect_detections defect_detections_basler_camera_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.defect_detections
    ADD CONSTRAINT defect_detections_basler_camera_id_fkey FOREIGN KEY (basler_camera_id) REFERENCES public.basler_devices(id) ON DELETE CASCADE;


--
-- TOC entry 5349 (class 2606 OID 46039)
-- Name: defect_detections defect_detections_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.defect_detections
    ADD CONSTRAINT defect_detections_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.ai_models(id) ON DELETE SET NULL;


--
-- TOC entry 5350 (class 2606 OID 46044)
-- Name: department_plant department_plant_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.department_plant
    ADD CONSTRAINT department_plant_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE CASCADE;


--
-- TOC entry 5351 (class 2606 OID 46049)
-- Name: department_plant department_plant_plant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.department_plant
    ADD CONSTRAINT department_plant_plant_id_fkey FOREIGN KEY (plant_id) REFERENCES public.plants(id) ON DELETE CASCADE;


--
-- TOC entry 5352 (class 2606 OID 46054)
-- Name: designations designations_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.designations
    ADD CONSTRAINT designations_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- TOC entry 5353 (class 2606 OID 46059)
-- Name: detection_assignments detection_assignments_camera_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.detection_assignments
    ADD CONSTRAINT detection_assignments_camera_id_fkey FOREIGN KEY (camera_id) REFERENCES public.cameras(id);


--
-- TOC entry 5354 (class 2606 OID 46064)
-- Name: detection_assignments detection_assignments_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.detection_assignments
    ADD CONSTRAINT detection_assignments_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.ai_model_classes(id);


--
-- TOC entry 5355 (class 2606 OID 46069)
-- Name: detection_assignments detection_assignments_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.detection_assignments
    ADD CONSTRAINT detection_assignments_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.ai_models(id);


--
-- TOC entry 5356 (class 2606 OID 46074)
-- Name: detection_assignments detection_assignments_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.detection_assignments
    ADD CONSTRAINT detection_assignments_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.zones(id);


--
-- TOC entry 5357 (class 2606 OID 46079)
-- Name: employee_movements employee_movements_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_movements
    ADD CONSTRAINT employee_movements_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- TOC entry 5358 (class 2606 OID 46084)
-- Name: employees employees_employee_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_employee_type_id_fkey FOREIGN KEY (employee_type_id) REFERENCES public.employee_types(id) ON DELETE SET NULL;


--
-- TOC entry 5359 (class 2606 OID 46089)
-- Name: hse_camera_rules hse_camera_rules_camera_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hse_camera_rules
    ADD CONSTRAINT hse_camera_rules_camera_id_fkey FOREIGN KEY (camera_id) REFERENCES public.cameras(id) ON DELETE CASCADE;


--
-- TOC entry 5360 (class 2606 OID 46094)
-- Name: hse_camera_rules hse_camera_rules_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hse_camera_rules
    ADD CONSTRAINT hse_camera_rules_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.hse_rule_definitions(id) ON DELETE CASCADE;


--
-- TOC entry 5361 (class 2606 OID 46099)
-- Name: hse_camera_rules hse_camera_rules_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hse_camera_rules
    ADD CONSTRAINT hse_camera_rules_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.zones(id) ON DELETE CASCADE;


--
-- TOC entry 5362 (class 2606 OID 46104)
-- Name: hse_rule_definitions hse_rule_definitions_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hse_rule_definitions
    ADD CONSTRAINT hse_rule_definitions_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.model_groups(id) ON DELETE SET NULL;


--
-- TOC entry 5363 (class 2606 OID 46109)
-- Name: hse_rule_events hse_rule_events_camera_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hse_rule_events
    ADD CONSTRAINT hse_rule_events_camera_id_fkey FOREIGN KEY (camera_id) REFERENCES public.cameras(id) ON DELETE SET NULL;


--
-- TOC entry 5364 (class 2606 OID 46114)
-- Name: hse_rule_events hse_rule_events_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hse_rule_events
    ADD CONSTRAINT hse_rule_events_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.hse_rule_definitions(id) ON DELETE SET NULL;


--
-- TOC entry 5365 (class 2606 OID 46119)
-- Name: incidents incidents_assignment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.incidents
    ADD CONSTRAINT incidents_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES public.detection_assignments(id) ON DELETE SET NULL;


--
-- TOC entry 5366 (class 2606 OID 46124)
-- Name: incidents incidents_camera_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.incidents
    ADD CONSTRAINT incidents_camera_id_fkey FOREIGN KEY (camera_id) REFERENCES public.cameras(id);


--
-- TOC entry 5367 (class 2606 OID 46129)
-- Name: incidents incidents_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.incidents
    ADD CONSTRAINT incidents_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.zones(id);


--
-- TOC entry 5368 (class 2606 OID 46134)
-- Name: notification_rule_recipients notification_rule_recipients_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_rule_recipients
    ADD CONSTRAINT notification_rule_recipients_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.recipient_groups(id);


--
-- TOC entry 5369 (class 2606 OID 46139)
-- Name: notification_rule_recipients notification_rule_recipients_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_rule_recipients
    ADD CONSTRAINT notification_rule_recipients_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.notification_rules(id);


--
-- TOC entry 5370 (class 2606 OID 46144)
-- Name: notification_rule_targets notification_rule_targets_camera_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_rule_targets
    ADD CONSTRAINT notification_rule_targets_camera_id_fkey FOREIGN KEY (camera_id) REFERENCES public.cameras(id);


--
-- TOC entry 5371 (class 2606 OID 46149)
-- Name: notification_rule_targets notification_rule_targets_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_rule_targets
    ADD CONSTRAINT notification_rule_targets_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.ai_model_classes(id);


--
-- TOC entry 5372 (class 2606 OID 46154)
-- Name: notification_rule_targets notification_rule_targets_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_rule_targets
    ADD CONSTRAINT notification_rule_targets_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.ai_models(id);


--
-- TOC entry 5373 (class 2606 OID 46159)
-- Name: notification_rule_targets notification_rule_targets_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_rule_targets
    ADD CONSTRAINT notification_rule_targets_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.notification_rules(id);


--
-- TOC entry 5374 (class 2606 OID 46164)
-- Name: notification_rule_targets notification_rule_targets_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_rule_targets
    ADD CONSTRAINT notification_rule_targets_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.zones(id);


--
-- TOC entry 5375 (class 2606 OID 46169)
-- Name: notification_rules notification_rules_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_rules
    ADD CONSTRAINT notification_rules_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.notification_templates(id);


--
-- TOC entry 5376 (class 2606 OID 46174)
-- Name: operator_shift_assignments operator_shift_assignments_camera_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.operator_shift_assignments
    ADD CONSTRAINT operator_shift_assignments_camera_id_fkey FOREIGN KEY (camera_id) REFERENCES public.cameras(id);


--
-- TOC entry 5377 (class 2606 OID 46179)
-- Name: operator_shift_assignments operator_shift_assignments_shift_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.operator_shift_assignments
    ADD CONSTRAINT operator_shift_assignments_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.shifts(id);


--
-- TOC entry 5378 (class 2606 OID 46184)
-- Name: operator_shift_assignments operator_shift_assignments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.operator_shift_assignments
    ADD CONSTRAINT operator_shift_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- TOC entry 5379 (class 2606 OID 46189)
-- Name: patrol_logs patrol_logs_guard_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.patrol_logs
    ADD CONSTRAINT patrol_logs_guard_id_fkey FOREIGN KEY (guard_id) REFERENCES public.security_guards(id) ON DELETE CASCADE;


--
-- TOC entry 5380 (class 2606 OID 46194)
-- Name: plants plants_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.plants
    ADD CONSTRAINT plants_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE SET NULL;


--
-- TOC entry 5381 (class 2606 OID 46199)
-- Name: recipients recipients_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recipients
    ADD CONSTRAINT recipients_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.recipient_groups(id);


--
-- TOC entry 5382 (class 2606 OID 46204)
-- Name: role_permissions role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id);


--
-- TOC entry 5383 (class 2606 OID 46209)
-- Name: supervisor_overrides supervisor_overrides_incident_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supervisor_overrides
    ADD CONSTRAINT supervisor_overrides_incident_id_fkey FOREIGN KEY (incident_id) REFERENCES public.incidents(id) ON DELETE CASCADE;


--
-- TOC entry 5384 (class 2606 OID 46214)
-- Name: supervisor_overrides supervisor_overrides_operator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supervisor_overrides
    ADD CONSTRAINT supervisor_overrides_operator_id_fkey FOREIGN KEY (operator_id) REFERENCES public.users(id);


--
-- TOC entry 5385 (class 2606 OID 46219)
-- Name: supervisor_overrides supervisor_overrides_supervisor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supervisor_overrides
    ADD CONSTRAINT supervisor_overrides_supervisor_id_fkey FOREIGN KEY (supervisor_id) REFERENCES public.users(id);


--
-- TOC entry 5386 (class 2606 OID 46224)
-- Name: user_activity_logs user_activity_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_activity_logs
    ADD CONSTRAINT user_activity_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 5387 (class 2606 OID 46229)
-- Name: users users_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- TOC entry 5388 (class 2606 OID 46234)
-- Name: users users_designation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_designation_id_fkey FOREIGN KEY (designation_id) REFERENCES public.designations(id);


--
-- TOC entry 5389 (class 2606 OID 46239)
-- Name: users users_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id);


--
-- TOC entry 5390 (class 2606 OID 46244)
-- Name: visitors visitors_host_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.visitors
    ADD CONSTRAINT visitors_host_employee_id_fkey FOREIGN KEY (host_employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- TOC entry 5391 (class 2606 OID 46249)
-- Name: zone_risk_scores zone_risk_scores_camera_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.zone_risk_scores
    ADD CONSTRAINT zone_risk_scores_camera_id_fkey FOREIGN KEY (camera_id) REFERENCES public.cameras(id) ON DELETE CASCADE;


--
-- TOC entry 5392 (class 2606 OID 46254)
-- Name: zone_risk_scores zone_risk_scores_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.zone_risk_scores
    ADD CONSTRAINT zone_risk_scores_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.zones(id) ON DELETE CASCADE;


--
-- TOC entry 5393 (class 2606 OID 46259)
-- Name: zones zones_camera_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.zones
    ADD CONSTRAINT zones_camera_id_fkey FOREIGN KEY (camera_id) REFERENCES public.cameras(id);


-- Completed on 2026-08-14 11:07:56

--
-- PostgreSQL database dump complete
--

\unrestrict 8Yd0d93qV6dNaX8W03x6SY5CjzPNJcAluhsekrLPw5RxoVEkNu9sPdXWXkSn3WH

