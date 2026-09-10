--
-- PostgreSQL database dump
--

\restrict chMT6UaDq3u2af44dRYXhJriTJMOhhDtfWpef3amu4GfEaZDdf9knf1fZndema9

-- Dumped from database version 17.10
-- Dumped by pg_dump version 17.10

-- Started on 2026-09-09 11:18:00

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

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 242 (class 1259 OID 37612)
-- Name: access_rules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.access_rules (
    id integer NOT NULL,
    employee_ids json,
    allowed_plant_ids json,
    allowed_department_ids json,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.access_rules OWNER TO postgres;

--
-- TOC entry 241 (class 1259 OID 37611)
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
-- TOC entry 5327 (class 0 OID 0)
-- Dependencies: 241
-- Name: access_rules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.access_rules_id_seq OWNED BY public.access_rules.id;


--
-- TOC entry 303 (class 1259 OID 38166)
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
-- TOC entry 302 (class 1259 OID 38165)
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
-- TOC entry 5328 (class 0 OID 0)
-- Dependencies: 302
-- Name: agent_recommendations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.agent_recommendations_id_seq OWNED BY public.agent_recommendations.id;


--
-- TOC entry 268 (class 1259 OID 37802)
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
-- TOC entry 267 (class 1259 OID 37801)
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
-- TOC entry 5329 (class 0 OID 0)
-- Dependencies: 267
-- Name: ai_model_classes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ai_model_classes_id_seq OWNED BY public.ai_model_classes.id;


--
-- TOC entry 248 (class 1259 OID 37644)
-- Name: ai_models; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ai_models (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    version character varying(100) NOT NULL,
    framework character varying(100) NOT NULL,
    model_path text NOT NULL,
    trt_engine_path text,
    trt_gpu_id integer,
    trt_ready boolean,
    trt_max_batch integer,
    config_path text,
    description text,
    is_active boolean,
    created_at timestamp without time zone DEFAULT now(),
    group_id integer
);


ALTER TABLE public.ai_models OWNER TO postgres;

--
-- TOC entry 247 (class 1259 OID 37643)
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
-- TOC entry 5330 (class 0 OID 0)
-- Dependencies: 247
-- Name: ai_models_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ai_models_id_seq OWNED BY public.ai_models.id;


--
-- TOC entry 313 (class 1259 OID 38262)
-- Name: alerts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.alerts (
    id integer NOT NULL,
    camera_id integer,
    camera_name character varying(255),
    zone_id integer,
    assignment_id integer,
    camera_rule_id integer,
    track_id integer NOT NULL,
    class_name character varying(255) NOT NULL,
    confidence double precision NOT NULL,
    snapshot_path text,
    is_acknowledged boolean,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.alerts OWNER TO postgres;

--
-- TOC entry 312 (class 1259 OID 38261)
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
-- TOC entry 5331 (class 0 OID 0)
-- Dependencies: 312
-- Name: alerts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.alerts_id_seq OWNED BY public.alerts.id;


--
-- TOC entry 305 (class 1259 OID 38187)
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
-- TOC entry 304 (class 1259 OID 38186)
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
-- TOC entry 5332 (class 0 OID 0)
-- Dependencies: 304
-- Name: anomaly_flags_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.anomaly_flags_id_seq OWNED BY public.anomaly_flags.id;


--
-- TOC entry 291 (class 1259 OID 38013)
-- Name: attendances; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.attendances (
    id integer NOT NULL,
    employee_id character varying(50) NOT NULL,
    "timestamp" timestamp without time zone DEFAULT now(),
    exit_time timestamp without time zone,
    duration_minutes double precision,
    punch_type character varying(50),
    camera_id integer,
    department_name character varying(100),
    entry_snapshot character varying(255),
    exit_snapshot character varying(255),
    is_restricted boolean
);


ALTER TABLE public.attendances OWNER TO postgres;

--
-- TOC entry 290 (class 1259 OID 38012)
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
-- TOC entry 5333 (class 0 OID 0)
-- Dependencies: 290
-- Name: attendances_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.attendances_id_seq OWNED BY public.attendances.id;


--
-- TOC entry 244 (class 1259 OID 37623)
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
-- TOC entry 243 (class 1259 OID 37622)
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
-- TOC entry 5334 (class 0 OID 0)
-- Dependencies: 243
-- Name: basler_devices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.basler_devices_id_seq OWNED BY public.basler_devices.id;


--
-- TOC entry 279 (class 1259 OID 37907)
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
-- TOC entry 278 (class 1259 OID 37906)
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
-- TOC entry 5335 (class 0 OID 0)
-- Dependencies: 278
-- Name: basler_model_assignments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.basler_model_assignments_id_seq OWNED BY public.basler_model_assignments.id;


--
-- TOC entry 287 (class 1259 OID 37978)
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
-- TOC entry 286 (class 1259 OID 37977)
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
-- TOC entry 5336 (class 0 OID 0)
-- Dependencies: 286
-- Name: camera_status_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.camera_status_logs_id_seq OWNED BY public.camera_status_logs.id;


--
-- TOC entry 266 (class 1259 OID 37777)
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
    use_for_face_recognition boolean,
    plant_id integer,
    location_id integer
);


ALTER TABLE public.cameras OWNER TO postgres;

--
-- TOC entry 265 (class 1259 OID 37776)
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
-- TOC entry 5337 (class 0 OID 0)
-- Dependencies: 265
-- Name: cameras_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.cameras_id_seq OWNED BY public.cameras.id;


--
-- TOC entry 301 (class 1259 OID 38144)
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
-- TOC entry 300 (class 1259 OID 38143)
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
-- TOC entry 5338 (class 0 OID 0)
-- Dependencies: 300
-- Name: correlated_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.correlated_events_id_seq OWNED BY public.correlated_events.id;


--
-- TOC entry 307 (class 1259 OID 38208)
-- Name: counting_batches; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.counting_batches (
    id integer NOT NULL,
    config_id integer,
    config_name character varying(256),
    daily_batch_number integer,
    start_time timestamp without time zone,
    end_time timestamp without time zone,
    count_in integer,
    count_out integer,
    total_count integer
);


ALTER TABLE public.counting_batches OWNER TO postgres;

--
-- TOC entry 306 (class 1259 OID 38207)
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
-- TOC entry 5339 (class 0 OID 0)
-- Dependencies: 306
-- Name: counting_batches_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.counting_batches_id_seq OWNED BY public.counting_batches.id;


--
-- TOC entry 289 (class 1259 OID 37993)
-- Name: counting_configs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.counting_configs (
    id integer NOT NULL,
    name character varying(256) NOT NULL,
    camera_id integer NOT NULL,
    model_id integer NOT NULL,
    counting_mode character varying(32),
    conveyor_name character varying(256),
    roi_type character varying(16),
    roi_points json,
    roi_line json,
    selected_classes json,
    direction_in character varying(64),
    direction_out character varying(64),
    enable_batching boolean,
    batch_idle_timeout integer,
    is_active boolean,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


ALTER TABLE public.counting_configs OWNER TO postgres;

--
-- TOC entry 288 (class 1259 OID 37992)
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
-- TOC entry 5340 (class 0 OID 0)
-- Dependencies: 288
-- Name: counting_configs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.counting_configs_id_seq OWNED BY public.counting_configs.id;


--
-- TOC entry 317 (class 1259 OID 38317)
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
-- TOC entry 316 (class 1259 OID 38316)
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
-- TOC entry 5341 (class 0 OID 0)
-- Dependencies: 316
-- Name: counting_recordings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.counting_recordings_id_seq OWNED BY public.counting_recordings.id;


--
-- TOC entry 309 (class 1259 OID 38221)
-- Name: counting_snapshots; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.counting_snapshots (
    id integer NOT NULL,
    config_id integer,
    config_name character varying(256),
    snapshot_date date,
    total_count integer,
    count_in integer,
    count_out integer
);


ALTER TABLE public.counting_snapshots OWNER TO postgres;

--
-- TOC entry 308 (class 1259 OID 38220)
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
-- TOC entry 5342 (class 0 OID 0)
-- Dependencies: 308
-- Name: counting_snapshots_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.counting_snapshots_id_seq OWNED BY public.counting_snapshots.id;


--
-- TOC entry 281 (class 1259 OID 37926)
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
-- TOC entry 280 (class 1259 OID 37925)
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
-- TOC entry 5343 (class 0 OID 0)
-- Dependencies: 280
-- Name: defect_detections_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.defect_detections_id_seq OWNED BY public.defect_detections.id;


--
-- TOC entry 273 (class 1259 OID 37861)
-- Name: department_plant; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.department_plant (
    department_id integer NOT NULL,
    plant_id integer NOT NULL
);


ALTER TABLE public.department_plant OWNER TO postgres;

--
-- TOC entry 228 (class 1259 OID 37541)
-- Name: departments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.departments (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description character varying(255)
);


ALTER TABLE public.departments OWNER TO postgres;

--
-- TOC entry 227 (class 1259 OID 37540)
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
-- TOC entry 5344 (class 0 OID 0)
-- Dependencies: 227
-- Name: departments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.departments_id_seq OWNED BY public.departments.id;


--
-- TOC entry 256 (class 1259 OID 37704)
-- Name: designations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.designations (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    department_id integer
);


ALTER TABLE public.designations OWNER TO postgres;

--
-- TOC entry 255 (class 1259 OID 37703)
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
-- TOC entry 5345 (class 0 OID 0)
-- Dependencies: 255
-- Name: designations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.designations_id_seq OWNED BY public.designations.id;


--
-- TOC entry 295 (class 1259 OID 38059)
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
-- TOC entry 294 (class 1259 OID 38058)
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
-- TOC entry 5346 (class 0 OID 0)
-- Dependencies: 294
-- Name: detection_assignments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.detection_assignments_id_seq OWNED BY public.detection_assignments.id;


--
-- TOC entry 277 (class 1259 OID 37892)
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
-- TOC entry 276 (class 1259 OID 37891)
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
-- TOC entry 5347 (class 0 OID 0)
-- Dependencies: 276
-- Name: employee_movements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.employee_movements_id_seq OWNED BY public.employee_movements.id;


--
-- TOC entry 238 (class 1259 OID 37591)
-- Name: employee_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.employee_types (
    id integer NOT NULL,
    type_name character varying(100) NOT NULL,
    description character varying(255)
);


ALTER TABLE public.employee_types OWNER TO postgres;

--
-- TOC entry 237 (class 1259 OID 37590)
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
-- TOC entry 5348 (class 0 OID 0)
-- Dependencies: 237
-- Name: employee_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.employee_types_id_seq OWNED BY public.employee_types.id;


--
-- TOC entry 260 (class 1259 OID 37728)
-- Name: employees; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.employees (
    id integer NOT NULL,
    employee_id character varying(50) NOT NULL,
    employee_name character varying(100) NOT NULL,
    email character varying(100) NOT NULL,
    plant character varying(100),
    location character varying(100),
    department character varying(100),
    date_of_birth character varying(50),
    gender character varying(20),
    contact_no character varying(50),
    face_encoding json,
    profile_picture text,
    employee_type_id integer,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.employees OWNER TO postgres;

--
-- TOC entry 259 (class 1259 OID 37727)
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
-- TOC entry 5349 (class 0 OID 0)
-- Dependencies: 259
-- Name: employees_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.employees_id_seq OWNED BY public.employees.id;


--
-- TOC entry 232 (class 1259 OID 37559)
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
-- TOC entry 231 (class 1259 OID 37558)
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
-- TOC entry 5350 (class 0 OID 0)
-- Dependencies: 231
-- Name: evaluator_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.evaluator_templates_id_seq OWNED BY public.evaluator_templates.id;


--
-- TOC entry 311 (class 1259 OID 38234)
-- Name: hse_camera_rules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.hse_camera_rules (
    id integer NOT NULL,
    camera_id integer NOT NULL,
    rule_id integer NOT NULL,
    zone_id integer,
    config_override json,
    is_active boolean,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.hse_camera_rules OWNER TO postgres;

--
-- TOC entry 310 (class 1259 OID 38233)
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
-- TOC entry 5351 (class 0 OID 0)
-- Dependencies: 310
-- Name: hse_camera_rules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.hse_camera_rules_id_seq OWNED BY public.hse_camera_rules.id;


--
-- TOC entry 264 (class 1259 OID 37760)
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
-- TOC entry 263 (class 1259 OID 37759)
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
-- TOC entry 5352 (class 0 OID 0)
-- Dependencies: 263
-- Name: hse_rule_definitions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.hse_rule_definitions_id_seq OWNED BY public.hse_rule_definitions.id;


--
-- TOC entry 293 (class 1259 OID 38035)
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
-- TOC entry 292 (class 1259 OID 38034)
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
-- TOC entry 5353 (class 0 OID 0)
-- Dependencies: 292
-- Name: hse_rule_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.hse_rule_events_id_seq OWNED BY public.hse_rule_events.id;


--
-- TOC entry 315 (class 1259 OID 38292)
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
    resolved_at timestamp without time zone
);


ALTER TABLE public.incidents OWNER TO postgres;

--
-- TOC entry 314 (class 1259 OID 38291)
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
-- TOC entry 5354 (class 0 OID 0)
-- Dependencies: 314
-- Name: incidents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.incidents_id_seq OWNED BY public.incidents.id;


--
-- TOC entry 236 (class 1259 OID 37582)
-- Name: locations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.locations (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description character varying(255)
);


ALTER TABLE public.locations OWNER TO postgres;

--
-- TOC entry 235 (class 1259 OID 37581)
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
-- TOC entry 5355 (class 0 OID 0)
-- Dependencies: 235
-- Name: locations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.locations_id_seq OWNED BY public.locations.id;


--
-- TOC entry 218 (class 1259 OID 37488)
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
-- TOC entry 217 (class 1259 OID 37487)
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
-- TOC entry 5356 (class 0 OID 0)
-- Dependencies: 217
-- Name: model_groups_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.model_groups_id_seq OWNED BY public.model_groups.id;


--
-- TOC entry 224 (class 1259 OID 37521)
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
-- TOC entry 223 (class 1259 OID 37520)
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
-- TOC entry 5357 (class 0 OID 0)
-- Dependencies: 223
-- Name: notification_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.notification_logs_id_seq OWNED BY public.notification_logs.id;


--
-- TOC entry 272 (class 1259 OID 37845)
-- Name: notification_rule_recipients; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notification_rule_recipients (
    id integer NOT NULL,
    rule_id integer,
    group_id integer
);


ALTER TABLE public.notification_rule_recipients OWNER TO postgres;

--
-- TOC entry 271 (class 1259 OID 37844)
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
-- TOC entry 5358 (class 0 OID 0)
-- Dependencies: 271
-- Name: notification_rule_recipients_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.notification_rule_recipients_id_seq OWNED BY public.notification_rule_recipients.id;


--
-- TOC entry 297 (class 1259 OID 38089)
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
-- TOC entry 296 (class 1259 OID 38088)
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
-- TOC entry 5359 (class 0 OID 0)
-- Dependencies: 296
-- Name: notification_rule_targets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.notification_rule_targets_id_seq OWNED BY public.notification_rule_targets.id;


--
-- TOC entry 252 (class 1259 OID 37675)
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
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.notification_rules OWNER TO postgres;

--
-- TOC entry 251 (class 1259 OID 37674)
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
-- TOC entry 5360 (class 0 OID 0)
-- Dependencies: 251
-- Name: notification_rules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.notification_rules_id_seq OWNED BY public.notification_rules.id;


--
-- TOC entry 226 (class 1259 OID 37531)
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
-- TOC entry 225 (class 1259 OID 37530)
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
-- TOC entry 5361 (class 0 OID 0)
-- Dependencies: 225
-- Name: notification_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.notification_settings_id_seq OWNED BY public.notification_settings.id;


--
-- TOC entry 220 (class 1259 OID 37501)
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
-- TOC entry 219 (class 1259 OID 37500)
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
-- TOC entry 5362 (class 0 OID 0)
-- Dependencies: 219
-- Name: notification_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.notification_templates_id_seq OWNED BY public.notification_templates.id;


--
-- TOC entry 262 (class 1259 OID 37747)
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
-- TOC entry 261 (class 1259 OID 37746)
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
-- TOC entry 5363 (class 0 OID 0)
-- Dependencies: 261
-- Name: patrol_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.patrol_logs_id_seq OWNED BY public.patrol_logs.id;


--
-- TOC entry 254 (class 1259 OID 37690)
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
-- TOC entry 253 (class 1259 OID 37689)
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
-- TOC entry 5364 (class 0 OID 0)
-- Dependencies: 253
-- Name: plants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.plants_id_seq OWNED BY public.plants.id;


--
-- TOC entry 222 (class 1259 OID 37511)
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
-- TOC entry 221 (class 1259 OID 37510)
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
-- TOC entry 5365 (class 0 OID 0)
-- Dependencies: 221
-- Name: recipient_groups_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.recipient_groups_id_seq OWNED BY public.recipient_groups.id;


--
-- TOC entry 250 (class 1259 OID 37660)
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
-- TOC entry 249 (class 1259 OID 37659)
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
-- TOC entry 5366 (class 0 OID 0)
-- Dependencies: 249
-- Name: recipients_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.recipients_id_seq OWNED BY public.recipients.id;


--
-- TOC entry 258 (class 1259 OID 37716)
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.role_permissions (
    id integer NOT NULL,
    role_id integer NOT NULL,
    component character varying(100) NOT NULL
);


ALTER TABLE public.role_permissions OWNER TO postgres;

--
-- TOC entry 257 (class 1259 OID 37715)
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
-- TOC entry 5367 (class 0 OID 0)
-- Dependencies: 257
-- Name: role_permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.role_permissions_id_seq OWNED BY public.role_permissions.id;


--
-- TOC entry 230 (class 1259 OID 37550)
-- Name: roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.roles (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    mobile_access boolean
);


ALTER TABLE public.roles OWNER TO postgres;

--
-- TOC entry 229 (class 1259 OID 37549)
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
-- TOC entry 5368 (class 0 OID 0)
-- Dependencies: 229
-- Name: roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.roles_id_seq OWNED BY public.roles.id;


--
-- TOC entry 246 (class 1259 OID 37634)
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
-- TOC entry 245 (class 1259 OID 37633)
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
-- TOC entry 5369 (class 0 OID 0)
-- Dependencies: 245
-- Name: scheduled_reports_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.scheduled_reports_id_seq OWNED BY public.scheduled_reports.id;


--
-- TOC entry 240 (class 1259 OID 37600)
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
-- TOC entry 239 (class 1259 OID 37599)
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
-- TOC entry 5370 (class 0 OID 0)
-- Dependencies: 239
-- Name: security_guards_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.security_guards_id_seq OWNED BY public.security_guards.id;


--
-- TOC entry 234 (class 1259 OID 37572)
-- Name: system_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.system_settings (
    id integer NOT NULL,
    archive_days character varying(50),
    auto_delete_low_severity boolean,
    storage_location character varying(50),
    session_timeout character varying(50),
    enforce_2fa boolean,
    api_token_expiry character varying(50),
    ip_allowlist text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone
);


ALTER TABLE public.system_settings OWNER TO postgres;

--
-- TOC entry 233 (class 1259 OID 37571)
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
-- TOC entry 5371 (class 0 OID 0)
-- Dependencies: 233
-- Name: system_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.system_settings_id_seq OWNED BY public.system_settings.id;


--
-- TOC entry 285 (class 1259 OID 37962)
-- Name: user_activity_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_activity_logs (
    id integer NOT NULL,
    user_id integer NOT NULL,
    action character varying(100) NOT NULL,
    detail text,
    ip_address character varying(45),
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.user_activity_logs OWNER TO postgres;

--
-- TOC entry 284 (class 1259 OID 37961)
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
-- TOC entry 5372 (class 0 OID 0)
-- Dependencies: 284
-- Name: user_activity_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_activity_logs_id_seq OWNED BY public.user_activity_logs.id;


--
-- TOC entry 270 (class 1259 OID 37815)
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
-- TOC entry 269 (class 1259 OID 37814)
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
-- TOC entry 5373 (class 0 OID 0)
-- Dependencies: 269
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- TOC entry 275 (class 1259 OID 37877)
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
    plant character varying(100),
    location character varying(100),
    entry_time timestamp without time zone,
    exit_time timestamp without time zone,
    photo text
);


ALTER TABLE public.visitors OWNER TO postgres;

--
-- TOC entry 274 (class 1259 OID 37876)
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
-- TOC entry 5374 (class 0 OID 0)
-- Dependencies: 274
-- Name: visitors_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.visitors_id_seq OWNED BY public.visitors.id;


--
-- TOC entry 299 (class 1259 OID 38121)
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
-- TOC entry 298 (class 1259 OID 38120)
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
-- TOC entry 5375 (class 0 OID 0)
-- Dependencies: 298
-- Name: zone_risk_scores_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.zone_risk_scores_id_seq OWNED BY public.zone_risk_scores.id;


--
-- TOC entry 283 (class 1259 OID 37947)
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
-- TOC entry 282 (class 1259 OID 37946)
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
-- TOC entry 5376 (class 0 OID 0)
-- Dependencies: 282
-- Name: zones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.zones_id_seq OWNED BY public.zones.id;


--
-- TOC entry 4880 (class 2604 OID 37615)
-- Name: access_rules id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.access_rules ALTER COLUMN id SET DEFAULT nextval('public.access_rules_id_seq'::regclass);


--
-- TOC entry 4932 (class 2604 OID 38169)
-- Name: agent_recommendations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agent_recommendations ALTER COLUMN id SET DEFAULT nextval('public.agent_recommendations_id_seq'::regclass);


--
-- TOC entry 4902 (class 2604 OID 37805)
-- Name: ai_model_classes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_model_classes ALTER COLUMN id SET DEFAULT nextval('public.ai_model_classes_id_seq'::regclass);


--
-- TOC entry 4886 (class 2604 OID 37647)
-- Name: ai_models id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_models ALTER COLUMN id SET DEFAULT nextval('public.ai_models_id_seq'::regclass);


--
-- TOC entry 4940 (class 2604 OID 38265)
-- Name: alerts id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alerts ALTER COLUMN id SET DEFAULT nextval('public.alerts_id_seq'::regclass);


--
-- TOC entry 4934 (class 2604 OID 38190)
-- Name: anomaly_flags id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.anomaly_flags ALTER COLUMN id SET DEFAULT nextval('public.anomaly_flags_id_seq'::regclass);


--
-- TOC entry 4921 (class 2604 OID 38016)
-- Name: attendances id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendances ALTER COLUMN id SET DEFAULT nextval('public.attendances_id_seq'::regclass);


--
-- TOC entry 4882 (class 2604 OID 37626)
-- Name: basler_devices id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.basler_devices ALTER COLUMN id SET DEFAULT nextval('public.basler_devices_id_seq'::regclass);


--
-- TOC entry 4910 (class 2604 OID 37910)
-- Name: basler_model_assignments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.basler_model_assignments ALTER COLUMN id SET DEFAULT nextval('public.basler_model_assignments_id_seq'::regclass);


--
-- TOC entry 4918 (class 2604 OID 37981)
-- Name: camera_status_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.camera_status_logs ALTER COLUMN id SET DEFAULT nextval('public.camera_status_logs_id_seq'::regclass);


--
-- TOC entry 4901 (class 2604 OID 37780)
-- Name: cameras id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cameras ALTER COLUMN id SET DEFAULT nextval('public.cameras_id_seq'::regclass);


--
-- TOC entry 4930 (class 2604 OID 38147)
-- Name: correlated_events id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.correlated_events ALTER COLUMN id SET DEFAULT nextval('public.correlated_events_id_seq'::regclass);


--
-- TOC entry 4936 (class 2604 OID 38211)
-- Name: counting_batches id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.counting_batches ALTER COLUMN id SET DEFAULT nextval('public.counting_batches_id_seq'::regclass);


--
-- TOC entry 4920 (class 2604 OID 37996)
-- Name: counting_configs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.counting_configs ALTER COLUMN id SET DEFAULT nextval('public.counting_configs_id_seq'::regclass);


--
-- TOC entry 4944 (class 2604 OID 38320)
-- Name: counting_recordings id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.counting_recordings ALTER COLUMN id SET DEFAULT nextval('public.counting_recordings_id_seq'::regclass);


--
-- TOC entry 4937 (class 2604 OID 38224)
-- Name: counting_snapshots id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.counting_snapshots ALTER COLUMN id SET DEFAULT nextval('public.counting_snapshots_id_seq'::regclass);


--
-- TOC entry 4912 (class 2604 OID 37929)
-- Name: defect_detections id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.defect_detections ALTER COLUMN id SET DEFAULT nextval('public.defect_detections_id_seq'::regclass);


--
-- TOC entry 4870 (class 2604 OID 37544)
-- Name: departments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.departments ALTER COLUMN id SET DEFAULT nextval('public.departments_id_seq'::regclass);


--
-- TOC entry 4893 (class 2604 OID 37707)
-- Name: designations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.designations ALTER COLUMN id SET DEFAULT nextval('public.designations_id_seq'::regclass);


--
-- TOC entry 4925 (class 2604 OID 38062)
-- Name: detection_assignments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.detection_assignments ALTER COLUMN id SET DEFAULT nextval('public.detection_assignments_id_seq'::regclass);


--
-- TOC entry 4908 (class 2604 OID 37895)
-- Name: employee_movements id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_movements ALTER COLUMN id SET DEFAULT nextval('public.employee_movements_id_seq'::regclass);


--
-- TOC entry 4877 (class 2604 OID 37594)
-- Name: employee_types id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_types ALTER COLUMN id SET DEFAULT nextval('public.employee_types_id_seq'::regclass);


--
-- TOC entry 4895 (class 2604 OID 37731)
-- Name: employees id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees ALTER COLUMN id SET DEFAULT nextval('public.employees_id_seq'::regclass);


--
-- TOC entry 4872 (class 2604 OID 37562)
-- Name: evaluator_templates id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evaluator_templates ALTER COLUMN id SET DEFAULT nextval('public.evaluator_templates_id_seq'::regclass);


--
-- TOC entry 4938 (class 2604 OID 38237)
-- Name: hse_camera_rules id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hse_camera_rules ALTER COLUMN id SET DEFAULT nextval('public.hse_camera_rules_id_seq'::regclass);


--
-- TOC entry 4898 (class 2604 OID 37763)
-- Name: hse_rule_definitions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hse_rule_definitions ALTER COLUMN id SET DEFAULT nextval('public.hse_rule_definitions_id_seq'::regclass);


--
-- TOC entry 4923 (class 2604 OID 38038)
-- Name: hse_rule_events id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hse_rule_events ALTER COLUMN id SET DEFAULT nextval('public.hse_rule_events_id_seq'::regclass);


--
-- TOC entry 4942 (class 2604 OID 38295)
-- Name: incidents id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.incidents ALTER COLUMN id SET DEFAULT nextval('public.incidents_id_seq'::regclass);


--
-- TOC entry 4876 (class 2604 OID 37585)
-- Name: locations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.locations ALTER COLUMN id SET DEFAULT nextval('public.locations_id_seq'::regclass);


--
-- TOC entry 4860 (class 2604 OID 37491)
-- Name: model_groups id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.model_groups ALTER COLUMN id SET DEFAULT nextval('public.model_groups_id_seq'::regclass);


--
-- TOC entry 4866 (class 2604 OID 37524)
-- Name: notification_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_logs ALTER COLUMN id SET DEFAULT nextval('public.notification_logs_id_seq'::regclass);


--
-- TOC entry 4906 (class 2604 OID 37848)
-- Name: notification_rule_recipients id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_rule_recipients ALTER COLUMN id SET DEFAULT nextval('public.notification_rule_recipients_id_seq'::regclass);


--
-- TOC entry 4927 (class 2604 OID 38092)
-- Name: notification_rule_targets id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_rule_targets ALTER COLUMN id SET DEFAULT nextval('public.notification_rule_targets_id_seq'::regclass);


--
-- TOC entry 4890 (class 2604 OID 37678)
-- Name: notification_rules id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_rules ALTER COLUMN id SET DEFAULT nextval('public.notification_rules_id_seq'::regclass);


--
-- TOC entry 4868 (class 2604 OID 37534)
-- Name: notification_settings id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_settings ALTER COLUMN id SET DEFAULT nextval('public.notification_settings_id_seq'::regclass);


--
-- TOC entry 4862 (class 2604 OID 37504)
-- Name: notification_templates id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_templates ALTER COLUMN id SET DEFAULT nextval('public.notification_templates_id_seq'::regclass);


--
-- TOC entry 4897 (class 2604 OID 37750)
-- Name: patrol_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.patrol_logs ALTER COLUMN id SET DEFAULT nextval('public.patrol_logs_id_seq'::regclass);


--
-- TOC entry 4892 (class 2604 OID 37693)
-- Name: plants id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.plants ALTER COLUMN id SET DEFAULT nextval('public.plants_id_seq'::regclass);


--
-- TOC entry 4864 (class 2604 OID 37514)
-- Name: recipient_groups id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recipient_groups ALTER COLUMN id SET DEFAULT nextval('public.recipient_groups_id_seq'::regclass);


--
-- TOC entry 4888 (class 2604 OID 37663)
-- Name: recipients id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recipients ALTER COLUMN id SET DEFAULT nextval('public.recipients_id_seq'::regclass);


--
-- TOC entry 4894 (class 2604 OID 37719)
-- Name: role_permissions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions ALTER COLUMN id SET DEFAULT nextval('public.role_permissions_id_seq'::regclass);


--
-- TOC entry 4871 (class 2604 OID 37553)
-- Name: roles id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_id_seq'::regclass);


--
-- TOC entry 4884 (class 2604 OID 37637)
-- Name: scheduled_reports id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scheduled_reports ALTER COLUMN id SET DEFAULT nextval('public.scheduled_reports_id_seq'::regclass);


--
-- TOC entry 4878 (class 2604 OID 37603)
-- Name: security_guards id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.security_guards ALTER COLUMN id SET DEFAULT nextval('public.security_guards_id_seq'::regclass);


--
-- TOC entry 4874 (class 2604 OID 37575)
-- Name: system_settings id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_settings ALTER COLUMN id SET DEFAULT nextval('public.system_settings_id_seq'::regclass);


--
-- TOC entry 4916 (class 2604 OID 37965)
-- Name: user_activity_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_activity_logs ALTER COLUMN id SET DEFAULT nextval('public.user_activity_logs_id_seq'::regclass);


--
-- TOC entry 4904 (class 2604 OID 37818)
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- TOC entry 4907 (class 2604 OID 37880)
-- Name: visitors id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.visitors ALTER COLUMN id SET DEFAULT nextval('public.visitors_id_seq'::regclass);


--
-- TOC entry 4928 (class 2604 OID 38124)
-- Name: zone_risk_scores id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.zone_risk_scores ALTER COLUMN id SET DEFAULT nextval('public.zone_risk_scores_id_seq'::regclass);


--
-- TOC entry 4914 (class 2604 OID 37950)
-- Name: zones id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.zones ALTER COLUMN id SET DEFAULT nextval('public.zones_id_seq'::regclass);


--
-- TOC entry 4986 (class 2606 OID 37620)
-- Name: access_rules access_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.access_rules
    ADD CONSTRAINT access_rules_pkey PRIMARY KEY (id);


--
-- TOC entry 5087 (class 2606 OID 38174)
-- Name: agent_recommendations agent_recommendations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agent_recommendations
    ADD CONSTRAINT agent_recommendations_pkey PRIMARY KEY (id);


--
-- TOC entry 5026 (class 2606 OID 37808)
-- Name: ai_model_classes ai_model_classes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_model_classes
    ADD CONSTRAINT ai_model_classes_pkey PRIMARY KEY (id);


--
-- TOC entry 4996 (class 2606 OID 37652)
-- Name: ai_models ai_models_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_models
    ADD CONSTRAINT ai_models_pkey PRIMARY KEY (id);


--
-- TOC entry 5104 (class 2606 OID 38270)
-- Name: alerts alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_pkey PRIMARY KEY (id);


--
-- TOC entry 5090 (class 2606 OID 38195)
-- Name: anomaly_flags anomaly_flags_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.anomaly_flags
    ADD CONSTRAINT anomaly_flags_pkey PRIMARY KEY (id);


--
-- TOC entry 5064 (class 2606 OID 38021)
-- Name: attendances attendances_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendances
    ADD CONSTRAINT attendances_pkey PRIMARY KEY (id);


--
-- TOC entry 4989 (class 2606 OID 37629)
-- Name: basler_devices basler_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.basler_devices
    ADD CONSTRAINT basler_devices_pkey PRIMARY KEY (id);


--
-- TOC entry 4991 (class 2606 OID 37631)
-- Name: basler_devices basler_devices_serial_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.basler_devices
    ADD CONSTRAINT basler_devices_serial_number_key UNIQUE (serial_number);


--
-- TOC entry 5046 (class 2606 OID 37913)
-- Name: basler_model_assignments basler_model_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.basler_model_assignments
    ADD CONSTRAINT basler_model_assignments_pkey PRIMARY KEY (id);


--
-- TOC entry 5057 (class 2606 OID 37984)
-- Name: camera_status_logs camera_status_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.camera_status_logs
    ADD CONSTRAINT camera_status_logs_pkey PRIMARY KEY (id);


--
-- TOC entry 5023 (class 2606 OID 37784)
-- Name: cameras cameras_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cameras
    ADD CONSTRAINT cameras_pkey PRIMARY KEY (id);


--
-- TOC entry 5083 (class 2606 OID 38152)
-- Name: correlated_events correlated_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.correlated_events
    ADD CONSTRAINT correlated_events_pkey PRIMARY KEY (id);


--
-- TOC entry 5093 (class 2606 OID 38213)
-- Name: counting_batches counting_batches_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.counting_batches
    ADD CONSTRAINT counting_batches_pkey PRIMARY KEY (id);


--
-- TOC entry 5061 (class 2606 OID 38001)
-- Name: counting_configs counting_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.counting_configs
    ADD CONSTRAINT counting_configs_pkey PRIMARY KEY (id);


--
-- TOC entry 5108 (class 2606 OID 38324)
-- Name: counting_recordings counting_recordings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.counting_recordings
    ADD CONSTRAINT counting_recordings_pkey PRIMARY KEY (id);


--
-- TOC entry 5096 (class 2606 OID 38226)
-- Name: counting_snapshots counting_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.counting_snapshots
    ADD CONSTRAINT counting_snapshots_pkey PRIMARY KEY (id);


--
-- TOC entry 5049 (class 2606 OID 37934)
-- Name: defect_detections defect_detections_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.defect_detections
    ADD CONSTRAINT defect_detections_pkey PRIMARY KEY (id);


--
-- TOC entry 5037 (class 2606 OID 37865)
-- Name: department_plant department_plant_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.department_plant
    ADD CONSTRAINT department_plant_pkey PRIMARY KEY (department_id, plant_id);


--
-- TOC entry 4959 (class 2606 OID 37548)
-- Name: departments departments_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_name_key UNIQUE (name);


--
-- TOC entry 4961 (class 2606 OID 37546)
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- TOC entry 5007 (class 2606 OID 37709)
-- Name: designations designations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.designations
    ADD CONSTRAINT designations_pkey PRIMARY KEY (id);


--
-- TOC entry 5074 (class 2606 OID 38067)
-- Name: detection_assignments detection_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.detection_assignments
    ADD CONSTRAINT detection_assignments_pkey PRIMARY KEY (id);


--
-- TOC entry 5042 (class 2606 OID 37898)
-- Name: employee_movements employee_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_movements
    ADD CONSTRAINT employee_movements_pkey PRIMARY KEY (id);


--
-- TOC entry 4978 (class 2606 OID 37596)
-- Name: employee_types employee_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_types
    ADD CONSTRAINT employee_types_pkey PRIMARY KEY (id);


--
-- TOC entry 4980 (class 2606 OID 37598)
-- Name: employee_types employee_types_type_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_types
    ADD CONSTRAINT employee_types_type_name_key UNIQUE (type_name);


--
-- TOC entry 5011 (class 2606 OID 37738)
-- Name: employees employees_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_email_key UNIQUE (email);


--
-- TOC entry 5013 (class 2606 OID 37736)
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);


--
-- TOC entry 4967 (class 2606 OID 37569)
-- Name: evaluator_templates evaluator_templates_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evaluator_templates
    ADD CONSTRAINT evaluator_templates_name_key UNIQUE (name);


--
-- TOC entry 4969 (class 2606 OID 37567)
-- Name: evaluator_templates evaluator_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evaluator_templates
    ADD CONSTRAINT evaluator_templates_pkey PRIMARY KEY (id);


--
-- TOC entry 5099 (class 2606 OID 38242)
-- Name: hse_camera_rules hse_camera_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hse_camera_rules
    ADD CONSTRAINT hse_camera_rules_pkey PRIMARY KEY (id);


--
-- TOC entry 5020 (class 2606 OID 37769)
-- Name: hse_rule_definitions hse_rule_definitions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hse_rule_definitions
    ADD CONSTRAINT hse_rule_definitions_pkey PRIMARY KEY (id);


--
-- TOC entry 5068 (class 2606 OID 38043)
-- Name: hse_rule_events hse_rule_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hse_rule_events
    ADD CONSTRAINT hse_rule_events_pkey PRIMARY KEY (id);


--
-- TOC entry 5106 (class 2606 OID 38300)
-- Name: incidents incidents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.incidents
    ADD CONSTRAINT incidents_pkey PRIMARY KEY (id);


--
-- TOC entry 4974 (class 2606 OID 37589)
-- Name: locations locations_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_name_key UNIQUE (name);


--
-- TOC entry 4976 (class 2606 OID 37587)
-- Name: locations locations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_pkey PRIMARY KEY (id);


--
-- TOC entry 4947 (class 2606 OID 37498)
-- Name: model_groups model_groups_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.model_groups
    ADD CONSTRAINT model_groups_name_key UNIQUE (name);


--
-- TOC entry 4949 (class 2606 OID 37496)
-- Name: model_groups model_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.model_groups
    ADD CONSTRAINT model_groups_pkey PRIMARY KEY (id);


--
-- TOC entry 4955 (class 2606 OID 37529)
-- Name: notification_logs notification_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_logs
    ADD CONSTRAINT notification_logs_pkey PRIMARY KEY (id);


--
-- TOC entry 5035 (class 2606 OID 37850)
-- Name: notification_rule_recipients notification_rule_recipients_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_rule_recipients
    ADD CONSTRAINT notification_rule_recipients_pkey PRIMARY KEY (id);


--
-- TOC entry 5076 (class 2606 OID 38094)
-- Name: notification_rule_targets notification_rule_targets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_rule_targets
    ADD CONSTRAINT notification_rule_targets_pkey PRIMARY KEY (id);


--
-- TOC entry 5001 (class 2606 OID 37683)
-- Name: notification_rules notification_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_rules
    ADD CONSTRAINT notification_rules_pkey PRIMARY KEY (id);


--
-- TOC entry 4957 (class 2606 OID 37539)
-- Name: notification_settings notification_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_settings
    ADD CONSTRAINT notification_settings_pkey PRIMARY KEY (id);


--
-- TOC entry 4951 (class 2606 OID 37509)
-- Name: notification_templates notification_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_templates
    ADD CONSTRAINT notification_templates_pkey PRIMARY KEY (id);


--
-- TOC entry 5018 (class 2606 OID 37752)
-- Name: patrol_logs patrol_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.patrol_logs
    ADD CONSTRAINT patrol_logs_pkey PRIMARY KEY (id);


--
-- TOC entry 5003 (class 2606 OID 37697)
-- Name: plants plants_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.plants
    ADD CONSTRAINT plants_name_key UNIQUE (name);


--
-- TOC entry 5005 (class 2606 OID 37695)
-- Name: plants plants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.plants
    ADD CONSTRAINT plants_pkey PRIMARY KEY (id);


--
-- TOC entry 4953 (class 2606 OID 37519)
-- Name: recipient_groups recipient_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recipient_groups
    ADD CONSTRAINT recipient_groups_pkey PRIMARY KEY (id);


--
-- TOC entry 4999 (class 2606 OID 37668)
-- Name: recipients recipients_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recipients
    ADD CONSTRAINT recipients_pkey PRIMARY KEY (id);


--
-- TOC entry 5009 (class 2606 OID 37721)
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (id);


--
-- TOC entry 4963 (class 2606 OID 37557)
-- Name: roles roles_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_name_key UNIQUE (name);


--
-- TOC entry 4965 (class 2606 OID 37555)
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- TOC entry 4994 (class 2606 OID 37642)
-- Name: scheduled_reports scheduled_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scheduled_reports
    ADD CONSTRAINT scheduled_reports_pkey PRIMARY KEY (id);


--
-- TOC entry 4984 (class 2606 OID 37608)
-- Name: security_guards security_guards_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.security_guards
    ADD CONSTRAINT security_guards_pkey PRIMARY KEY (id);


--
-- TOC entry 4972 (class 2606 OID 37580)
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (id);


--
-- TOC entry 5055 (class 2606 OID 37970)
-- Name: user_activity_logs user_activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_activity_logs
    ADD CONSTRAINT user_activity_logs_pkey PRIMARY KEY (id);


--
-- TOC entry 5029 (class 2606 OID 37825)
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- TOC entry 5031 (class 2606 OID 37823)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 5033 (class 2606 OID 37827)
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- TOC entry 5040 (class 2606 OID 37884)
-- Name: visitors visitors_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.visitors
    ADD CONSTRAINT visitors_pkey PRIMARY KEY (id);


--
-- TOC entry 5081 (class 2606 OID 38129)
-- Name: zone_risk_scores zone_risk_scores_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.zone_risk_scores
    ADD CONSTRAINT zone_risk_scores_pkey PRIMARY KEY (id);


--
-- TOC entry 5052 (class 2606 OID 37955)
-- Name: zones zones_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.zones
    ADD CONSTRAINT zones_pkey PRIMARY KEY (id);


--
-- TOC entry 4987 (class 1259 OID 37621)
-- Name: ix_access_rules_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_access_rules_id ON public.access_rules USING btree (id);


--
-- TOC entry 5088 (class 1259 OID 38185)
-- Name: ix_agent_recommendations_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_agent_recommendations_id ON public.agent_recommendations USING btree (id);


--
-- TOC entry 4997 (class 1259 OID 37658)
-- Name: ix_ai_models_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_ai_models_id ON public.ai_models USING btree (id);


--
-- TOC entry 5091 (class 1259 OID 38206)
-- Name: ix_anomaly_flags_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_anomaly_flags_id ON public.anomaly_flags USING btree (id);


--
-- TOC entry 5065 (class 1259 OID 38033)
-- Name: ix_attendances_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_attendances_id ON public.attendances USING btree (id);


--
-- TOC entry 5066 (class 1259 OID 38032)
-- Name: ix_attendances_timestamp; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_attendances_timestamp ON public.attendances USING btree ("timestamp");


--
-- TOC entry 4992 (class 1259 OID 37632)
-- Name: ix_basler_devices_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_basler_devices_id ON public.basler_devices USING btree (id);


--
-- TOC entry 5047 (class 1259 OID 37924)
-- Name: ix_basler_model_assignments_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_basler_model_assignments_id ON public.basler_model_assignments USING btree (id);


--
-- TOC entry 5058 (class 1259 OID 37991)
-- Name: ix_camera_status_logs_camera_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_camera_status_logs_camera_id ON public.camera_status_logs USING btree (camera_id);


--
-- TOC entry 5059 (class 1259 OID 37990)
-- Name: ix_camera_status_logs_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_camera_status_logs_id ON public.camera_status_logs USING btree (id);


--
-- TOC entry 5024 (class 1259 OID 37800)
-- Name: ix_cameras_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_cameras_id ON public.cameras USING btree (id);


--
-- TOC entry 5084 (class 1259 OID 38164)
-- Name: ix_correlated_events_camera_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_correlated_events_camera_id ON public.correlated_events USING btree (camera_id);


--
-- TOC entry 5085 (class 1259 OID 38163)
-- Name: ix_correlated_events_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_correlated_events_id ON public.correlated_events USING btree (id);


--
-- TOC entry 5094 (class 1259 OID 38219)
-- Name: ix_counting_batches_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_counting_batches_id ON public.counting_batches USING btree (id);


--
-- TOC entry 5062 (class 1259 OID 38011)
-- Name: ix_counting_configs_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_counting_configs_id ON public.counting_configs USING btree (id);


--
-- TOC entry 5109 (class 1259 OID 38335)
-- Name: ix_counting_recordings_folder_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_counting_recordings_folder_date ON public.counting_recordings USING btree (folder_date);


--
-- TOC entry 5110 (class 1259 OID 38336)
-- Name: ix_counting_recordings_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_counting_recordings_id ON public.counting_recordings USING btree (id);


--
-- TOC entry 5097 (class 1259 OID 38232)
-- Name: ix_counting_snapshots_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_counting_snapshots_id ON public.counting_snapshots USING btree (id);


--
-- TOC entry 5050 (class 1259 OID 37945)
-- Name: ix_defect_detections_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_defect_detections_id ON public.defect_detections USING btree (id);


--
-- TOC entry 5043 (class 1259 OID 37905)
-- Name: ix_employee_movements_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_employee_movements_id ON public.employee_movements USING btree (id);


--
-- TOC entry 5044 (class 1259 OID 37904)
-- Name: ix_employee_movements_time_in; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_employee_movements_time_in ON public.employee_movements USING btree (time_in);


--
-- TOC entry 5014 (class 1259 OID 37745)
-- Name: ix_employees_employee_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ix_employees_employee_id ON public.employees USING btree (employee_id);


--
-- TOC entry 5015 (class 1259 OID 37744)
-- Name: ix_employees_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_employees_id ON public.employees USING btree (id);


--
-- TOC entry 4970 (class 1259 OID 37570)
-- Name: ix_evaluator_templates_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_evaluator_templates_id ON public.evaluator_templates USING btree (id);


--
-- TOC entry 5100 (class 1259 OID 38259)
-- Name: ix_hse_camera_rules_camera_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_hse_camera_rules_camera_id ON public.hse_camera_rules USING btree (camera_id);


--
-- TOC entry 5101 (class 1259 OID 38260)
-- Name: ix_hse_camera_rules_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_hse_camera_rules_id ON public.hse_camera_rules USING btree (id);


--
-- TOC entry 5102 (class 1259 OID 38258)
-- Name: ix_hse_camera_rules_zone_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_hse_camera_rules_zone_id ON public.hse_camera_rules USING btree (zone_id);


--
-- TOC entry 5021 (class 1259 OID 37775)
-- Name: ix_hse_rule_definitions_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_hse_rule_definitions_id ON public.hse_rule_definitions USING btree (id);


--
-- TOC entry 5069 (class 1259 OID 38056)
-- Name: ix_hse_rule_events_camera_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_hse_rule_events_camera_id ON public.hse_rule_events USING btree (camera_id);


--
-- TOC entry 5070 (class 1259 OID 38057)
-- Name: ix_hse_rule_events_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_hse_rule_events_id ON public.hse_rule_events USING btree (id);


--
-- TOC entry 5071 (class 1259 OID 38054)
-- Name: ix_hse_rule_events_rule_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_hse_rule_events_rule_id ON public.hse_rule_events USING btree (rule_id);


--
-- TOC entry 5072 (class 1259 OID 38055)
-- Name: ix_hse_rule_events_triggered_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_hse_rule_events_triggered_at ON public.hse_rule_events USING btree (triggered_at);


--
-- TOC entry 4945 (class 1259 OID 37499)
-- Name: ix_model_groups_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_model_groups_id ON public.model_groups USING btree (id);


--
-- TOC entry 5016 (class 1259 OID 37758)
-- Name: ix_patrol_logs_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_patrol_logs_id ON public.patrol_logs USING btree (id);


--
-- TOC entry 4981 (class 1259 OID 37609)
-- Name: ix_security_guards_guard_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ix_security_guards_guard_id ON public.security_guards USING btree (guard_id);


--
-- TOC entry 4982 (class 1259 OID 37610)
-- Name: ix_security_guards_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_security_guards_id ON public.security_guards USING btree (id);


--
-- TOC entry 5053 (class 1259 OID 37976)
-- Name: ix_user_activity_logs_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_user_activity_logs_id ON public.user_activity_logs USING btree (id);


--
-- TOC entry 5027 (class 1259 OID 37843)
-- Name: ix_users_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_users_id ON public.users USING btree (id);


--
-- TOC entry 5038 (class 1259 OID 37890)
-- Name: ix_visitors_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_visitors_id ON public.visitors USING btree (id);


--
-- TOC entry 5077 (class 1259 OID 38142)
-- Name: ix_zone_risk_scores_camera_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_zone_risk_scores_camera_id ON public.zone_risk_scores USING btree (camera_id);


--
-- TOC entry 5078 (class 1259 OID 38141)
-- Name: ix_zone_risk_scores_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_zone_risk_scores_id ON public.zone_risk_scores USING btree (id);


--
-- TOC entry 5079 (class 1259 OID 38140)
-- Name: ix_zone_risk_scores_zone_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_zone_risk_scores_zone_id ON public.zone_risk_scores USING btree (zone_id);


--
-- TOC entry 5159 (class 2606 OID 38180)
-- Name: agent_recommendations agent_recommendations_camera_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agent_recommendations
    ADD CONSTRAINT agent_recommendations_camera_id_fkey FOREIGN KEY (camera_id) REFERENCES public.cameras(id) ON DELETE SET NULL;


--
-- TOC entry 5160 (class 2606 OID 38175)
-- Name: agent_recommendations agent_recommendations_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agent_recommendations
    ADD CONSTRAINT agent_recommendations_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.zones(id) ON DELETE SET NULL;


--
-- TOC entry 5123 (class 2606 OID 37809)
-- Name: ai_model_classes ai_model_classes_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_model_classes
    ADD CONSTRAINT ai_model_classes_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.ai_models(id);


--
-- TOC entry 5111 (class 2606 OID 37653)
-- Name: ai_models ai_models_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_models
    ADD CONSTRAINT ai_models_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.model_groups(id);


--
-- TOC entry 5168 (class 2606 OID 38281)
-- Name: alerts alerts_assignment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES public.detection_assignments(id) ON DELETE SET NULL;


--
-- TOC entry 5169 (class 2606 OID 38271)
-- Name: alerts alerts_camera_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_camera_id_fkey FOREIGN KEY (camera_id) REFERENCES public.cameras(id) ON DELETE SET NULL;


--
-- TOC entry 5170 (class 2606 OID 38286)
-- Name: alerts alerts_camera_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_camera_rule_id_fkey FOREIGN KEY (camera_rule_id) REFERENCES public.hse_camera_rules(id) ON DELETE SET NULL;


--
-- TOC entry 5171 (class 2606 OID 38276)
-- Name: alerts alerts_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.zones(id);


--
-- TOC entry 5161 (class 2606 OID 38201)
-- Name: anomaly_flags anomaly_flags_camera_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.anomaly_flags
    ADD CONSTRAINT anomaly_flags_camera_id_fkey FOREIGN KEY (camera_id) REFERENCES public.cameras(id) ON DELETE SET NULL;


--
-- TOC entry 5162 (class 2606 OID 38196)
-- Name: anomaly_flags anomaly_flags_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.anomaly_flags
    ADD CONSTRAINT anomaly_flags_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.zones(id) ON DELETE SET NULL;


--
-- TOC entry 5142 (class 2606 OID 38027)
-- Name: attendances attendances_camera_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendances
    ADD CONSTRAINT attendances_camera_id_fkey FOREIGN KEY (camera_id) REFERENCES public.cameras(id) ON DELETE SET NULL;


--
-- TOC entry 5143 (class 2606 OID 38022)
-- Name: attendances attendances_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendances
    ADD CONSTRAINT attendances_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(employee_id) ON DELETE CASCADE;


--
-- TOC entry 5133 (class 2606 OID 37914)
-- Name: basler_model_assignments basler_model_assignments_basler_camera_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.basler_model_assignments
    ADD CONSTRAINT basler_model_assignments_basler_camera_id_fkey FOREIGN KEY (basler_camera_id) REFERENCES public.basler_devices(id) ON DELETE CASCADE;


--
-- TOC entry 5134 (class 2606 OID 37919)
-- Name: basler_model_assignments basler_model_assignments_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.basler_model_assignments
    ADD CONSTRAINT basler_model_assignments_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.ai_models(id) ON DELETE CASCADE;


--
-- TOC entry 5139 (class 2606 OID 37985)
-- Name: camera_status_logs camera_status_logs_camera_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.camera_status_logs
    ADD CONSTRAINT camera_status_logs_camera_id_fkey FOREIGN KEY (camera_id) REFERENCES public.cameras(id) ON DELETE CASCADE;


--
-- TOC entry 5120 (class 2606 OID 37785)
-- Name: cameras cameras_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cameras
    ADD CONSTRAINT cameras_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- TOC entry 5121 (class 2606 OID 37795)
-- Name: cameras cameras_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cameras
    ADD CONSTRAINT cameras_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE SET NULL;


--
-- TOC entry 5122 (class 2606 OID 37790)
-- Name: cameras cameras_plant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cameras
    ADD CONSTRAINT cameras_plant_id_fkey FOREIGN KEY (plant_id) REFERENCES public.plants(id) ON DELETE SET NULL;


--
-- TOC entry 5157 (class 2606 OID 38153)
-- Name: correlated_events correlated_events_camera_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.correlated_events
    ADD CONSTRAINT correlated_events_camera_id_fkey FOREIGN KEY (camera_id) REFERENCES public.cameras(id) ON DELETE SET NULL;


--
-- TOC entry 5158 (class 2606 OID 38158)
-- Name: correlated_events correlated_events_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.correlated_events
    ADD CONSTRAINT correlated_events_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.zones(id) ON DELETE SET NULL;


--
-- TOC entry 5163 (class 2606 OID 44821)
-- Name: counting_batches counting_batches_config_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.counting_batches
    ADD CONSTRAINT counting_batches_config_id_fkey FOREIGN KEY (config_id) REFERENCES public.counting_configs(id) ON DELETE SET NULL;


--
-- TOC entry 5140 (class 2606 OID 38001)
-- Name: counting_configs counting_configs_camera_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.counting_configs
    ADD CONSTRAINT counting_configs_camera_id_fkey FOREIGN KEY (camera_id) REFERENCES public.cameras(id);


--
-- TOC entry 5141 (class 2606 OID 38006)
-- Name: counting_configs counting_configs_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.counting_configs
    ADD CONSTRAINT counting_configs_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.ai_models(id);


--
-- TOC entry 5175 (class 2606 OID 38330)
-- Name: counting_recordings counting_recordings_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.counting_recordings
    ADD CONSTRAINT counting_recordings_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.counting_batches(id);


--
-- TOC entry 5176 (class 2606 OID 44831)
-- Name: counting_recordings counting_recordings_config_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.counting_recordings
    ADD CONSTRAINT counting_recordings_config_id_fkey FOREIGN KEY (config_id) REFERENCES public.counting_configs(id) ON DELETE SET NULL;


--
-- TOC entry 5164 (class 2606 OID 44826)
-- Name: counting_snapshots counting_snapshots_config_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.counting_snapshots
    ADD CONSTRAINT counting_snapshots_config_id_fkey FOREIGN KEY (config_id) REFERENCES public.counting_configs(id) ON DELETE SET NULL;


--
-- TOC entry 5135 (class 2606 OID 37935)
-- Name: defect_detections defect_detections_basler_camera_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.defect_detections
    ADD CONSTRAINT defect_detections_basler_camera_id_fkey FOREIGN KEY (basler_camera_id) REFERENCES public.basler_devices(id) ON DELETE CASCADE;


--
-- TOC entry 5136 (class 2606 OID 37940)
-- Name: defect_detections defect_detections_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.defect_detections
    ADD CONSTRAINT defect_detections_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.ai_models(id) ON DELETE SET NULL;


--
-- TOC entry 5129 (class 2606 OID 37866)
-- Name: department_plant department_plant_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.department_plant
    ADD CONSTRAINT department_plant_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE CASCADE;


--
-- TOC entry 5130 (class 2606 OID 37871)
-- Name: department_plant department_plant_plant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.department_plant
    ADD CONSTRAINT department_plant_plant_id_fkey FOREIGN KEY (plant_id) REFERENCES public.plants(id) ON DELETE CASCADE;


--
-- TOC entry 5115 (class 2606 OID 37710)
-- Name: designations designations_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.designations
    ADD CONSTRAINT designations_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- TOC entry 5146 (class 2606 OID 38068)
-- Name: detection_assignments detection_assignments_camera_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.detection_assignments
    ADD CONSTRAINT detection_assignments_camera_id_fkey FOREIGN KEY (camera_id) REFERENCES public.cameras(id);


--
-- TOC entry 5147 (class 2606 OID 38083)
-- Name: detection_assignments detection_assignments_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.detection_assignments
    ADD CONSTRAINT detection_assignments_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.ai_model_classes(id);


--
-- TOC entry 5148 (class 2606 OID 38078)
-- Name: detection_assignments detection_assignments_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.detection_assignments
    ADD CONSTRAINT detection_assignments_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.ai_models(id);


--
-- TOC entry 5149 (class 2606 OID 38073)
-- Name: detection_assignments detection_assignments_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.detection_assignments
    ADD CONSTRAINT detection_assignments_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.zones(id);


--
-- TOC entry 5132 (class 2606 OID 37899)
-- Name: employee_movements employee_movements_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_movements
    ADD CONSTRAINT employee_movements_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- TOC entry 5117 (class 2606 OID 37739)
-- Name: employees employees_employee_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_employee_type_id_fkey FOREIGN KEY (employee_type_id) REFERENCES public.employee_types(id) ON DELETE SET NULL;


--
-- TOC entry 5165 (class 2606 OID 38243)
-- Name: hse_camera_rules hse_camera_rules_camera_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hse_camera_rules
    ADD CONSTRAINT hse_camera_rules_camera_id_fkey FOREIGN KEY (camera_id) REFERENCES public.cameras(id) ON DELETE CASCADE;


--
-- TOC entry 5166 (class 2606 OID 38248)
-- Name: hse_camera_rules hse_camera_rules_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hse_camera_rules
    ADD CONSTRAINT hse_camera_rules_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.hse_rule_definitions(id) ON DELETE CASCADE;


--
-- TOC entry 5167 (class 2606 OID 38253)
-- Name: hse_camera_rules hse_camera_rules_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hse_camera_rules
    ADD CONSTRAINT hse_camera_rules_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.zones(id) ON DELETE CASCADE;


--
-- TOC entry 5119 (class 2606 OID 37770)
-- Name: hse_rule_definitions hse_rule_definitions_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hse_rule_definitions
    ADD CONSTRAINT hse_rule_definitions_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.model_groups(id) ON DELETE SET NULL;


--
-- TOC entry 5144 (class 2606 OID 38044)
-- Name: hse_rule_events hse_rule_events_camera_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hse_rule_events
    ADD CONSTRAINT hse_rule_events_camera_id_fkey FOREIGN KEY (camera_id) REFERENCES public.cameras(id) ON DELETE SET NULL;


--
-- TOC entry 5145 (class 2606 OID 38049)
-- Name: hse_rule_events hse_rule_events_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hse_rule_events
    ADD CONSTRAINT hse_rule_events_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.hse_rule_definitions(id) ON DELETE SET NULL;


--
-- TOC entry 5172 (class 2606 OID 38311)
-- Name: incidents incidents_assignment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.incidents
    ADD CONSTRAINT incidents_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES public.detection_assignments(id) ON DELETE SET NULL;


--
-- TOC entry 5173 (class 2606 OID 38301)
-- Name: incidents incidents_camera_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.incidents
    ADD CONSTRAINT incidents_camera_id_fkey FOREIGN KEY (camera_id) REFERENCES public.cameras(id) ON DELETE SET NULL;


--
-- TOC entry 5174 (class 2606 OID 38306)
-- Name: incidents incidents_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.incidents
    ADD CONSTRAINT incidents_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.zones(id);


--
-- TOC entry 5127 (class 2606 OID 37856)
-- Name: notification_rule_recipients notification_rule_recipients_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_rule_recipients
    ADD CONSTRAINT notification_rule_recipients_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.recipient_groups(id);


--
-- TOC entry 5128 (class 2606 OID 37851)
-- Name: notification_rule_recipients notification_rule_recipients_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_rule_recipients
    ADD CONSTRAINT notification_rule_recipients_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.notification_rules(id);


--
-- TOC entry 5150 (class 2606 OID 38100)
-- Name: notification_rule_targets notification_rule_targets_camera_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_rule_targets
    ADD CONSTRAINT notification_rule_targets_camera_id_fkey FOREIGN KEY (camera_id) REFERENCES public.cameras(id);


--
-- TOC entry 5151 (class 2606 OID 38115)
-- Name: notification_rule_targets notification_rule_targets_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_rule_targets
    ADD CONSTRAINT notification_rule_targets_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.ai_model_classes(id);


--
-- TOC entry 5152 (class 2606 OID 38110)
-- Name: notification_rule_targets notification_rule_targets_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_rule_targets
    ADD CONSTRAINT notification_rule_targets_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.ai_models(id);


--
-- TOC entry 5153 (class 2606 OID 38095)
-- Name: notification_rule_targets notification_rule_targets_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_rule_targets
    ADD CONSTRAINT notification_rule_targets_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.notification_rules(id);


--
-- TOC entry 5154 (class 2606 OID 38105)
-- Name: notification_rule_targets notification_rule_targets_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_rule_targets
    ADD CONSTRAINT notification_rule_targets_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.zones(id);


--
-- TOC entry 5113 (class 2606 OID 37684)
-- Name: notification_rules notification_rules_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_rules
    ADD CONSTRAINT notification_rules_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.notification_templates(id);


--
-- TOC entry 5118 (class 2606 OID 37753)
-- Name: patrol_logs patrol_logs_guard_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.patrol_logs
    ADD CONSTRAINT patrol_logs_guard_id_fkey FOREIGN KEY (guard_id) REFERENCES public.security_guards(id) ON DELETE CASCADE;


--
-- TOC entry 5114 (class 2606 OID 37698)
-- Name: plants plants_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.plants
    ADD CONSTRAINT plants_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE SET NULL;


--
-- TOC entry 5112 (class 2606 OID 37669)
-- Name: recipients recipients_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recipients
    ADD CONSTRAINT recipients_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.recipient_groups(id);


--
-- TOC entry 5116 (class 2606 OID 37722)
-- Name: role_permissions role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id);


--
-- TOC entry 5138 (class 2606 OID 37971)
-- Name: user_activity_logs user_activity_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_activity_logs
    ADD CONSTRAINT user_activity_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 5124 (class 2606 OID 37833)
-- Name: users users_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- TOC entry 5125 (class 2606 OID 37838)
-- Name: users users_designation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_designation_id_fkey FOREIGN KEY (designation_id) REFERENCES public.designations(id);


--
-- TOC entry 5126 (class 2606 OID 37828)
-- Name: users users_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id);


--
-- TOC entry 5131 (class 2606 OID 37885)
-- Name: visitors visitors_host_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.visitors
    ADD CONSTRAINT visitors_host_employee_id_fkey FOREIGN KEY (host_employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- TOC entry 5155 (class 2606 OID 38135)
-- Name: zone_risk_scores zone_risk_scores_camera_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.zone_risk_scores
    ADD CONSTRAINT zone_risk_scores_camera_id_fkey FOREIGN KEY (camera_id) REFERENCES public.cameras(id) ON DELETE CASCADE;


--
-- TOC entry 5156 (class 2606 OID 38130)
-- Name: zone_risk_scores zone_risk_scores_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.zone_risk_scores
    ADD CONSTRAINT zone_risk_scores_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.zones(id) ON DELETE CASCADE;


--
-- TOC entry 5137 (class 2606 OID 37956)
-- Name: zones zones_camera_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.zones
    ADD CONSTRAINT zones_camera_id_fkey FOREIGN KEY (camera_id) REFERENCES public.cameras(id);


-- Completed on 2026-09-09 11:18:01

--
-- PostgreSQL database dump complete
--

\unrestrict chMT6UaDq3u2af44dRYXhJriTJMOhhDtfWpef3amu4GfEaZDdf9knf1fZndema9

