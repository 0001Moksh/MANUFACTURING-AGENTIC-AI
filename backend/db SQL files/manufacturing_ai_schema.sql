--
-- PostgreSQL database dump
--

\restrict RYr9jC2jmYrSOIKkhxdrZEKby4hOIGN2V6HALmrRWcS9BVbdEOKkAFuw14YQxOj

-- Dumped from database version 18.4
-- Dumped by pg_dump version 18.4

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
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: update_modified_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_modified_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_modified_column() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: agent_execution_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.agent_execution_logs (
    execution_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    agentic_id character varying(50),
    started_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    completed_at timestamp with time zone,
    status character varying(30) DEFAULT 'running'::character varying,
    execution_time_ms bigint,
    error_message text,
    meta jsonb,
    customer_id integer DEFAULT 1
);


ALTER TABLE public.agent_execution_logs OWNER TO postgres;

--
-- Name: agent_tool_mapping; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.agent_tool_mapping (
    agentic_id character varying(50) NOT NULL,
    tool_id bigint NOT NULL
);


ALTER TABLE public.agent_tool_mapping OWNER TO postgres;

--
-- Name: agentic_pipline; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.agentic_pipline (
    agentic_id character varying(50) NOT NULL,
    system_prompt text NOT NULL,
    tools_list character varying(100)[],
    agent_desp text,
    required_app_access character varying(50),
    active_status boolean DEFAULT false,
    output_sample jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.agentic_pipline OWNER TO postgres;

--
-- Name: alert_master; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.alert_master (
    alert_id bigint NOT NULL,
    severity character varying(20) DEFAULT 'Warning'::character varying,
    is_acknowledged boolean DEFAULT false,
    is_resolved boolean DEFAULT false,
    created_date timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    machine_id text,
    source character varying(100),
    details jsonb,
    customer_id integer DEFAULT 1,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.alert_master OWNER TO postgres;

--
-- Name: alert_master_alert_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.alert_master_alert_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.alert_master_alert_id_seq OWNER TO postgres;

--
-- Name: alert_master_alert_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.alert_master_alert_id_seq OWNED BY public.alert_master.alert_id;


--
-- Name: api_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.api_logs (
    log_id bigint NOT NULL,
    api_id character varying(50),
    request_payload jsonb,
    response_payload jsonb,
    status_code integer,
    latency_ms integer,
    called_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    connection_id integer
);


ALTER TABLE public.api_logs OWNER TO postgres;

--
-- Name: api_logs_log_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.api_logs_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.api_logs_log_id_seq OWNER TO postgres;

--
-- Name: api_logs_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.api_logs_log_id_seq OWNED BY public.api_logs.log_id;


--
-- Name: app_authentication; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.app_authentication (
    auth_id bigint NOT NULL,
    connection_id integer,
    auth_type character varying(30),
    username text,
    password_encrypted text,
    api_key text,
    access_token text,
    refresh_token text,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.app_authentication OWNER TO postgres;

--
-- Name: app_authentication_auth_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.app_authentication_auth_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.app_authentication_auth_id_seq OWNER TO postgres;

--
-- Name: app_authentication_auth_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.app_authentication_auth_id_seq OWNED BY public.app_authentication.auth_id;


--
-- Name: app_connection_table; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.app_connection_table (
    connection_id integer NOT NULL,
    app_id character varying(50),
    user_id character varying(50),
    connection_status character varying(50) NOT NULL,
    backend_url text,
    last_hand_shake_at timestamp with time zone,
    version character varying(50),
    created_date timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.app_connection_table OWNER TO postgres;

--
-- Name: app_connection_table_connection_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.app_connection_table_connection_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.app_connection_table_connection_id_seq OWNER TO postgres;

--
-- Name: app_connection_table_connection_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.app_connection_table_connection_id_seq OWNED BY public.app_connection_table.connection_id;


--
-- Name: app_table; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.app_table (
    app_id character varying(50) NOT NULL,
    app_name character varying(100) NOT NULL,
    version_we_support character varying(50) NOT NULL,
    description text,
    connection_status character varying(50) DEFAULT 'Disconnected'::character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.app_table OWNER TO postgres;

--
-- Name: app_version_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.app_version_history (
    version_id bigint NOT NULL,
    app_id character varying(50),
    old_version character varying(50),
    new_version character varying(50),
    updated_by character varying(50),
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.app_version_history OWNER TO postgres;

--
-- Name: app_version_history_version_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.app_version_history_version_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.app_version_history_version_id_seq OWNER TO postgres;

--
-- Name: app_version_history_version_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.app_version_history_version_id_seq OWNED BY public.app_version_history.version_id;


--
-- Name: approval_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.approval_history (
    approval_id bigint NOT NULL,
    workflow_id uuid,
    approved_by character varying(50),
    approved_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    remarks text,
    status character varying(20)
);


ALTER TABLE public.approval_history OWNER TO postgres;

--
-- Name: approval_history_approval_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.approval_history_approval_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.approval_history_approval_id_seq OWNER TO postgres;

--
-- Name: approval_history_approval_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.approval_history_approval_id_seq OWNED BY public.approval_history.approval_id;


--
-- Name: backend_api_table; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.backend_api_table (
    api_id character varying(50) NOT NULL,
    method character varying(10) NOT NULL,
    end_point text NOT NULL,
    description text,
    parameters jsonb DEFAULT '{}'::jsonb,
    responses jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    tool_name character varying(150),
    authentication_required boolean DEFAULT false,
    request_body boolean DEFAULT false,
    api_group character varying(100),
    agent_accessible boolean DEFAULT false,
    auto_register boolean DEFAULT true,
    canonical_entity character varying(100),
    api_version character varying(30),
    raw_metadata jsonb,
    connection_id integer,
    required_fields jsonb,
    optional_fields jsonb,
    controller_name character varying(100),
    operation_id character varying(200)
);


ALTER TABLE public.backend_api_table OWNER TO postgres;

--
-- Name: canonical_mapping; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.canonical_mapping (
    mapping_id bigint NOT NULL,
    schema_id bigint,
    canonical_table text NOT NULL,
    canonical_column text NOT NULL,
    source_table text,
    source_column text,
    confidence_score numeric(5,2) DEFAULT 100.00,
    mapped_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.canonical_mapping OWNER TO postgres;

--
-- Name: canonical_mapping_mapping_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.canonical_mapping_mapping_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.canonical_mapping_mapping_id_seq OWNER TO postgres;

--
-- Name: canonical_mapping_mapping_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.canonical_mapping_mapping_id_seq OWNED BY public.canonical_mapping.mapping_id;


--
-- Name: connection_health_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.connection_health_log (
    health_id bigint NOT NULL,
    connection_id integer,
    status character varying(30),
    checked_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    response_time_ms integer,
    details jsonb
);


ALTER TABLE public.connection_health_log OWNER TO postgres;

--
-- Name: connection_health_log_health_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.connection_health_log_health_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.connection_health_log_health_id_seq OWNER TO postgres;

--
-- Name: connection_health_log_health_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.connection_health_log_health_id_seq OWNED BY public.connection_health_log.health_id;


--
-- Name: customer_table; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.customer_table (
    customer_id integer NOT NULL,
    company_name text NOT NULL,
    license_plan character varying(50) DEFAULT 'trial'::character varying,
    status character varying(20) DEFAULT 'active'::character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.customer_table OWNER TO postgres;

--
-- Name: customer_table_customer_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.customer_table_customer_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.customer_table_customer_id_seq OWNER TO postgres;

--
-- Name: customer_table_customer_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.customer_table_customer_id_seq OWNED BY public.customer_table.customer_id;


--
-- Name: database_connection; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.database_connection (
    db_connection_id bigint NOT NULL,
    connection_id integer,
    db_type character varying(30),
    host text,
    port integer,
    database_name text,
    schema_name text,
    username text,
    password_encrypted text,
    ssl_enabled boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    customer_id integer DEFAULT 1
);


ALTER TABLE public.database_connection OWNER TO postgres;

--
-- Name: database_connection_db_connection_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.database_connection_db_connection_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.database_connection_db_connection_id_seq OWNER TO postgres;

--
-- Name: database_connection_db_connection_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.database_connection_db_connection_id_seq OWNED BY public.database_connection.db_connection_id;


--
-- Name: notification_master; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notification_master (
    notification_id bigint NOT NULL,
    alert_id bigint,
    channel character varying(30),
    recipient text,
    payload jsonb,
    status character varying(20) DEFAULT 'pending'::character varying,
    sent_at timestamp with time zone
);


ALTER TABLE public.notification_master OWNER TO postgres;

--
-- Name: notification_master_notification_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.notification_master_notification_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notification_master_notification_id_seq OWNER TO postgres;

--
-- Name: notification_master_notification_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.notification_master_notification_id_seq OWNED BY public.notification_master.notification_id;


--
-- Name: oauth_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.oauth_tokens (
    token_id bigint NOT NULL,
    user_id character varying(50),
    provider character varying(50),
    access_token text,
    refresh_token text,
    expires_at timestamp with time zone,
    meta jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.oauth_tokens OWNER TO postgres;

--
-- Name: oauth_tokens_token_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.oauth_tokens_token_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.oauth_tokens_token_id_seq OWNER TO postgres;

--
-- Name: oauth_tokens_token_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.oauth_tokens_token_id_seq OWNED BY public.oauth_tokens.token_id;


--
-- Name: pipeline_required_apps; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pipeline_required_apps (
    agentic_id character varying(50) NOT NULL,
    app_id character varying(50) NOT NULL
);


ALTER TABLE public.pipeline_required_apps OWNER TO postgres;

--
-- Name: pipeline_step_apis; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pipeline_step_apis (
    step_id character varying(50) NOT NULL,
    api_id character varying(50) NOT NULL
);


ALTER TABLE public.pipeline_step_apis OWNER TO postgres;

--
-- Name: roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.roles (
    role_id integer NOT NULL,
    role_name character varying(100) NOT NULL,
    description text
);


ALTER TABLE public.roles OWNER TO postgres;

--
-- Name: roles_role_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.roles_role_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.roles_role_id_seq OWNER TO postgres;

--
-- Name: roles_role_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.roles_role_id_seq OWNED BY public.roles.role_id;


--
-- Name: schema_registry; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.schema_registry (
    schema_id bigint NOT NULL,
    connection_id integer,
    table_name text NOT NULL,
    column_name text NOT NULL,
    data_type text,
    is_primary_key boolean DEFAULT false,
    is_nullable boolean DEFAULT true,
    discovered_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.schema_registry OWNER TO postgres;

--
-- Name: schema_registry_schema_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.schema_registry_schema_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.schema_registry_schema_id_seq OWNER TO postgres;

--
-- Name: schema_registry_schema_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.schema_registry_schema_id_seq OWNED BY public.schema_registry.schema_id;


--
-- Name: steps_in_pipline; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.steps_in_pipline (
    step_id character varying(50) NOT NULL,
    agentic_id character varying(50),
    prompt text NOT NULL,
    human_in_loop_status boolean DEFAULT false,
    output_sample jsonb,
    in_use_status boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.steps_in_pipline OWNER TO postgres;

--
-- Name: tool_table; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tool_table (
    tool_id bigint NOT NULL,
    tool_name text NOT NULL,
    description text,
    tool_type character varying(50),
    status character varying(20) DEFAULT 'active'::character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    customer_id integer DEFAULT 1
);


ALTER TABLE public.tool_table OWNER TO postgres;

--
-- Name: tool_table_tool_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tool_table_tool_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tool_table_tool_id_seq OWNER TO postgres;

--
-- Name: tool_table_tool_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tool_table_tool_id_seq OWNED BY public.tool_table.tool_id;


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_roles (
    user_id character varying(50) NOT NULL,
    role_id integer NOT NULL
);


ALTER TABLE public.user_roles OWNER TO postgres;

--
-- Name: user_table; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_table (
    user_id character varying(50) NOT NULL,
    user_name character varying(100) NOT NULL,
    password_hash character varying(255) NOT NULL,
    active_status boolean DEFAULT true,
    access_module_json jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.user_table OWNER TO postgres;

--
-- Name: workflow_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.workflow_history (
    workflow_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    step_id character varying(50),
    agentic_id character varying(50),
    executed_by character varying(50),
    "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    input_state jsonb NOT NULL,
    output_state jsonb NOT NULL,
    approval_status character varying(20) DEFAULT 'Pending'::character varying,
    customer_id integer DEFAULT 1,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.workflow_history OWNER TO postgres;

--
-- Name: alert_master alert_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alert_master ALTER COLUMN alert_id SET DEFAULT nextval('public.alert_master_alert_id_seq'::regclass);


--
-- Name: api_logs log_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.api_logs ALTER COLUMN log_id SET DEFAULT nextval('public.api_logs_log_id_seq'::regclass);


--
-- Name: app_authentication auth_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_authentication ALTER COLUMN auth_id SET DEFAULT nextval('public.app_authentication_auth_id_seq'::regclass);


--
-- Name: app_connection_table connection_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_connection_table ALTER COLUMN connection_id SET DEFAULT nextval('public.app_connection_table_connection_id_seq'::regclass);


--
-- Name: app_version_history version_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_version_history ALTER COLUMN version_id SET DEFAULT nextval('public.app_version_history_version_id_seq'::regclass);


--
-- Name: approval_history approval_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.approval_history ALTER COLUMN approval_id SET DEFAULT nextval('public.approval_history_approval_id_seq'::regclass);


--
-- Name: canonical_mapping mapping_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.canonical_mapping ALTER COLUMN mapping_id SET DEFAULT nextval('public.canonical_mapping_mapping_id_seq'::regclass);


--
-- Name: connection_health_log health_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.connection_health_log ALTER COLUMN health_id SET DEFAULT nextval('public.connection_health_log_health_id_seq'::regclass);


--
-- Name: customer_table customer_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_table ALTER COLUMN customer_id SET DEFAULT nextval('public.customer_table_customer_id_seq'::regclass);


--
-- Name: database_connection db_connection_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.database_connection ALTER COLUMN db_connection_id SET DEFAULT nextval('public.database_connection_db_connection_id_seq'::regclass);


--
-- Name: notification_master notification_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_master ALTER COLUMN notification_id SET DEFAULT nextval('public.notification_master_notification_id_seq'::regclass);


--
-- Name: oauth_tokens token_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.oauth_tokens ALTER COLUMN token_id SET DEFAULT nextval('public.oauth_tokens_token_id_seq'::regclass);


--
-- Name: roles role_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles ALTER COLUMN role_id SET DEFAULT nextval('public.roles_role_id_seq'::regclass);


--
-- Name: schema_registry schema_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.schema_registry ALTER COLUMN schema_id SET DEFAULT nextval('public.schema_registry_schema_id_seq'::regclass);


--
-- Name: tool_table tool_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tool_table ALTER COLUMN tool_id SET DEFAULT nextval('public.tool_table_tool_id_seq'::regclass);


--
-- Name: agent_execution_logs agent_execution_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agent_execution_logs
    ADD CONSTRAINT agent_execution_logs_pkey PRIMARY KEY (execution_id);


--
-- Name: agent_tool_mapping agent_tool_mapping_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agent_tool_mapping
    ADD CONSTRAINT agent_tool_mapping_pkey PRIMARY KEY (agentic_id, tool_id);


--
-- Name: agentic_pipline agentic_pipline_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agentic_pipline
    ADD CONSTRAINT agentic_pipline_pkey PRIMARY KEY (agentic_id);


--
-- Name: alert_master alert_master_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alert_master
    ADD CONSTRAINT alert_master_pkey PRIMARY KEY (alert_id);


--
-- Name: api_logs api_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.api_logs
    ADD CONSTRAINT api_logs_pkey PRIMARY KEY (log_id);


--
-- Name: app_authentication app_authentication_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_authentication
    ADD CONSTRAINT app_authentication_pkey PRIMARY KEY (auth_id);


--
-- Name: app_connection_table app_connection_table_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_connection_table
    ADD CONSTRAINT app_connection_table_pkey PRIMARY KEY (connection_id);


--
-- Name: app_table app_table_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_table
    ADD CONSTRAINT app_table_pkey PRIMARY KEY (app_id);


--
-- Name: app_version_history app_version_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_version_history
    ADD CONSTRAINT app_version_history_pkey PRIMARY KEY (version_id);


--
-- Name: approval_history approval_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.approval_history
    ADD CONSTRAINT approval_history_pkey PRIMARY KEY (approval_id);


--
-- Name: backend_api_table backend_api_table_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.backend_api_table
    ADD CONSTRAINT backend_api_table_pkey PRIMARY KEY (api_id);


--
-- Name: canonical_mapping canonical_mapping_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.canonical_mapping
    ADD CONSTRAINT canonical_mapping_pkey PRIMARY KEY (mapping_id);


--
-- Name: connection_health_log connection_health_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.connection_health_log
    ADD CONSTRAINT connection_health_log_pkey PRIMARY KEY (health_id);


--
-- Name: customer_table customer_table_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_table
    ADD CONSTRAINT customer_table_pkey PRIMARY KEY (customer_id);


--
-- Name: database_connection database_connection_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.database_connection
    ADD CONSTRAINT database_connection_pkey PRIMARY KEY (db_connection_id);


--
-- Name: notification_master notification_master_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_master
    ADD CONSTRAINT notification_master_pkey PRIMARY KEY (notification_id);


--
-- Name: oauth_tokens oauth_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.oauth_tokens
    ADD CONSTRAINT oauth_tokens_pkey PRIMARY KEY (token_id);


--
-- Name: pipeline_required_apps pipeline_required_apps_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pipeline_required_apps
    ADD CONSTRAINT pipeline_required_apps_pkey PRIMARY KEY (agentic_id, app_id);


--
-- Name: pipeline_step_apis pipeline_step_apis_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pipeline_step_apis
    ADD CONSTRAINT pipeline_step_apis_pkey PRIMARY KEY (step_id, api_id);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (role_id);


--
-- Name: roles roles_role_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_role_name_key UNIQUE (role_name);


--
-- Name: schema_registry schema_registry_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.schema_registry
    ADD CONSTRAINT schema_registry_pkey PRIMARY KEY (schema_id);


--
-- Name: steps_in_pipline steps_in_pipline_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.steps_in_pipline
    ADD CONSTRAINT steps_in_pipline_pkey PRIMARY KEY (step_id);


--
-- Name: tool_table tool_table_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tool_table
    ADD CONSTRAINT tool_table_pkey PRIMARY KEY (tool_id);


--
-- Name: tool_table tool_table_tool_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tool_table
    ADD CONSTRAINT tool_table_tool_name_key UNIQUE (tool_name);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role_id);


--
-- Name: user_table user_table_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_table
    ADD CONSTRAINT user_table_pkey PRIMARY KEY (user_id);


--
-- Name: user_table user_table_user_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_table
    ADD CONSTRAINT user_table_user_name_key UNIQUE (user_name);


--
-- Name: workflow_history workflow_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workflow_history
    ADD CONSTRAINT workflow_history_pkey PRIMARY KEY (workflow_id);


--
-- Name: ix_agent_exec_agentic_started; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_agent_exec_agentic_started ON public.agent_execution_logs USING btree (agentic_id, started_at);


--
-- Name: ix_alert_master_severity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_alert_master_severity ON public.alert_master USING btree (severity);


--
-- Name: ix_api_logs_api_called_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_api_logs_api_called_at ON public.api_logs USING btree (api_id, called_at);


--
-- Name: ix_app_auth_conn; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_app_auth_conn ON public.app_authentication USING btree (connection_id);


--
-- Name: ix_appconn_appid; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_appconn_appid ON public.app_connection_table USING btree (app_id);


--
-- Name: ix_backendapi_method_endpoint; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_backendapi_method_endpoint ON public.backend_api_table USING btree (method, end_point);


--
-- Name: ix_canonical_mapping_table; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_canonical_mapping_table ON public.canonical_mapping USING btree (canonical_table, canonical_column);


--
-- Name: ix_conn_health_conn_ts; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_conn_health_conn_ts ON public.connection_health_log USING btree (connection_id, checked_at);


--
-- Name: ix_db_conn_conn; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_db_conn_conn ON public.database_connection USING btree (connection_id);


--
-- Name: ix_notification_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_notification_status ON public.notification_master USING btree (status);


--
-- Name: ix_schema_registry_table; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_schema_registry_table ON public.schema_registry USING btree (table_name);


--
-- Name: ix_workflow_history_agentic_ts; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_workflow_history_agentic_ts ON public.workflow_history USING btree (agentic_id, "timestamp");


--
-- Name: alert_master update_alert_master_modtime; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_alert_master_modtime BEFORE UPDATE ON public.alert_master FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();


--
-- Name: app_connection_table update_conn_modtime; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_conn_modtime BEFORE UPDATE ON public.app_connection_table FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();


--
-- Name: agentic_pipline update_pipeline_modtime; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_pipeline_modtime BEFORE UPDATE ON public.agentic_pipline FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();


--
-- Name: user_table update_user_modtime; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_user_modtime BEFORE UPDATE ON public.user_table FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();


--
-- Name: workflow_history update_workflow_history_modtime; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_workflow_history_modtime BEFORE UPDATE ON public.workflow_history FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();


--
-- Name: agent_execution_logs agent_execution_logs_agentic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agent_execution_logs
    ADD CONSTRAINT agent_execution_logs_agentic_id_fkey FOREIGN KEY (agentic_id) REFERENCES public.agentic_pipline(agentic_id) ON DELETE SET NULL;


--
-- Name: agent_execution_logs agent_execution_logs_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agent_execution_logs
    ADD CONSTRAINT agent_execution_logs_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customer_table(customer_id);


--
-- Name: agent_tool_mapping agent_tool_mapping_agentic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agent_tool_mapping
    ADD CONSTRAINT agent_tool_mapping_agentic_id_fkey FOREIGN KEY (agentic_id) REFERENCES public.agentic_pipline(agentic_id) ON DELETE CASCADE;


--
-- Name: agent_tool_mapping agent_tool_mapping_tool_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agent_tool_mapping
    ADD CONSTRAINT agent_tool_mapping_tool_id_fkey FOREIGN KEY (tool_id) REFERENCES public.tool_table(tool_id) ON DELETE CASCADE;


--
-- Name: agentic_pipline agentic_pipline_required_app_access_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agentic_pipline
    ADD CONSTRAINT agentic_pipline_required_app_access_fkey FOREIGN KEY (required_app_access) REFERENCES public.app_table(app_id) ON DELETE SET NULL;


--
-- Name: alert_master alert_master_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alert_master
    ADD CONSTRAINT alert_master_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customer_table(customer_id);


--
-- Name: api_logs api_logs_api_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.api_logs
    ADD CONSTRAINT api_logs_api_id_fkey FOREIGN KEY (api_id) REFERENCES public.backend_api_table(api_id) ON DELETE SET NULL;


--
-- Name: api_logs api_logs_connection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.api_logs
    ADD CONSTRAINT api_logs_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.app_connection_table(connection_id) ON DELETE SET NULL;


--
-- Name: app_authentication app_authentication_connection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_authentication
    ADD CONSTRAINT app_authentication_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.app_connection_table(connection_id) ON DELETE CASCADE;


--
-- Name: app_connection_table app_connection_table_app_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_connection_table
    ADD CONSTRAINT app_connection_table_app_id_fkey FOREIGN KEY (app_id) REFERENCES public.app_table(app_id) ON DELETE CASCADE;


--
-- Name: app_connection_table app_connection_table_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_connection_table
    ADD CONSTRAINT app_connection_table_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_table(user_id) ON DELETE SET NULL;


--
-- Name: app_version_history app_version_history_app_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_version_history
    ADD CONSTRAINT app_version_history_app_id_fkey FOREIGN KEY (app_id) REFERENCES public.app_table(app_id) ON DELETE CASCADE;


--
-- Name: approval_history approval_history_workflow_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.approval_history
    ADD CONSTRAINT approval_history_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.workflow_history(workflow_id) ON DELETE CASCADE;


--
-- Name: canonical_mapping canonical_mapping_schema_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.canonical_mapping
    ADD CONSTRAINT canonical_mapping_schema_id_fkey FOREIGN KEY (schema_id) REFERENCES public.schema_registry(schema_id) ON DELETE CASCADE;


--
-- Name: connection_health_log connection_health_log_connection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.connection_health_log
    ADD CONSTRAINT connection_health_log_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.app_connection_table(connection_id) ON DELETE CASCADE;


--
-- Name: database_connection database_connection_connection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.database_connection
    ADD CONSTRAINT database_connection_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.app_connection_table(connection_id) ON DELETE CASCADE;


--
-- Name: database_connection database_connection_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.database_connection
    ADD CONSTRAINT database_connection_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customer_table(customer_id);


--
-- Name: notification_master notification_master_alert_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_master
    ADD CONSTRAINT notification_master_alert_id_fkey FOREIGN KEY (alert_id) REFERENCES public.alert_master(alert_id) ON DELETE SET NULL;


--
-- Name: oauth_tokens oauth_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.oauth_tokens
    ADD CONSTRAINT oauth_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_table(user_id) ON DELETE SET NULL;


--
-- Name: pipeline_required_apps pipeline_required_apps_agentic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pipeline_required_apps
    ADD CONSTRAINT pipeline_required_apps_agentic_id_fkey FOREIGN KEY (agentic_id) REFERENCES public.agentic_pipline(agentic_id) ON DELETE CASCADE;


--
-- Name: pipeline_required_apps pipeline_required_apps_app_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pipeline_required_apps
    ADD CONSTRAINT pipeline_required_apps_app_id_fkey FOREIGN KEY (app_id) REFERENCES public.app_table(app_id) ON DELETE CASCADE;


--
-- Name: pipeline_step_apis pipeline_step_apis_api_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pipeline_step_apis
    ADD CONSTRAINT pipeline_step_apis_api_id_fkey FOREIGN KEY (api_id) REFERENCES public.backend_api_table(api_id) ON DELETE CASCADE;


--
-- Name: pipeline_step_apis pipeline_step_apis_step_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pipeline_step_apis
    ADD CONSTRAINT pipeline_step_apis_step_id_fkey FOREIGN KEY (step_id) REFERENCES public.steps_in_pipline(step_id) ON DELETE CASCADE;


--
-- Name: schema_registry schema_registry_connection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.schema_registry
    ADD CONSTRAINT schema_registry_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.app_connection_table(connection_id) ON DELETE CASCADE;


--
-- Name: steps_in_pipline steps_in_pipline_agentic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.steps_in_pipline
    ADD CONSTRAINT steps_in_pipline_agentic_id_fkey FOREIGN KEY (agentic_id) REFERENCES public.agentic_pipline(agentic_id) ON DELETE CASCADE;


--
-- Name: tool_table tool_table_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tool_table
    ADD CONSTRAINT tool_table_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customer_table(customer_id);


--
-- Name: user_roles user_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(role_id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_table(user_id) ON DELETE CASCADE;


--
-- Name: workflow_history workflow_history_agentic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workflow_history
    ADD CONSTRAINT workflow_history_agentic_id_fkey FOREIGN KEY (agentic_id) REFERENCES public.agentic_pipline(agentic_id) ON DELETE SET NULL;


--
-- Name: workflow_history workflow_history_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workflow_history
    ADD CONSTRAINT workflow_history_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customer_table(customer_id);


--
-- Name: workflow_history workflow_history_step_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workflow_history
    ADD CONSTRAINT workflow_history_step_id_fkey FOREIGN KEY (step_id) REFERENCES public.steps_in_pipline(step_id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict RYr9jC2jmYrSOIKkhxdrZEKby4hOIGN2V6HALmrRWcS9BVbdEOKkAFuw14YQxOj

