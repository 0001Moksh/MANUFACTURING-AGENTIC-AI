CREATE TABLE user_table (
    user_id VARCHAR(50) PRIMARY KEY,
    user_name VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    active_status BOOLEAN DEFAULT TRUE,
    access_module_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE app_table (
    app_id VARCHAR(50) PRIMARY KEY,
    app_name VARCHAR(100) NOT NULL,
    version_we_support VARCHAR(50) NOT NULL,
    description TEXT,
    connection_status VARCHAR(50) DEFAULT 'Disconnected',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE App_connection_table (
    connection_id SERIAL PRIMARY KEY,
    app_id VARCHAR(50) REFERENCES app_table(app_id) ON DELETE CASCADE,
    user_id VARCHAR(50) REFERENCES user_table(user_id) ON DELETE SET NULL,
    connection_status VARCHAR(50) NOT NULL,
    backend_url TEXT,
    last_hand_shake_at TIMESTAMP WITH TIME ZONE,
    version VARCHAR(50),
    created_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE backend_api_table (
    api_id VARCHAR(50) PRIMARY KEY,
    method VARCHAR(10) NOT NULL,
    end_point TEXT NOT NULL,
    description TEXT,
    access_to_use VARCHAR(100),
    parameter JSONB DEFAULT '{}'::jsonb,
    error_status JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE agentic_pipline (
    agentic_id VARCHAR(50) PRIMARY KEY,
    system_prompt TEXT NOT NULL,
    tools_list VARCHAR(100)[],
    agent_desp TEXT,
    required_app_access VARCHAR(50) REFERENCES app_table(app_id) ON DELETE SET NULL,
    active_status BOOLEAN DEFAULT FALSE,
    output_sample JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE steps_in_pipline (
    step_id VARCHAR(50) PRIMARY KEY,
    agentic_id VARCHAR(50) REFERENCES agentic_pipline(agentic_id) ON DELETE CASCADE,
    prompt TEXT NOT NULL,
    human_in_loop_status BOOLEAN DEFAULT FALSE,
    output_sample JSONB,
    in_use_status BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE pipeline_step_apis (
    step_id VARCHAR(50) REFERENCES steps_in_pipline(step_id) ON DELETE CASCADE,
    api_id VARCHAR(50) REFERENCES backend_api_table(api_id) ON DELETE CASCADE,
    PRIMARY KEY (step_id, api_id)
);

CREATE TABLE customer_table (
    customer_id SERIAL PRIMARY KEY,
    company_name TEXT NOT NULL,
    license_plan VARCHAR(50) DEFAULT 'trial',
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE workflow_history (
    workflow_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    step_id VARCHAR(50) REFERENCES steps_in_pipline(step_id) ON DELETE SET NULL,
    agentic_id VARCHAR(50) REFERENCES agentic_pipline(agentic_id) ON DELETE SET NULL,
    executed_by VARCHAR(50),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    input_state JSONB NOT NULL,
    output_state JSONB NOT NULL,
    approval_status VARCHAR(20) DEFAULT 'Pending',
    customer_id INT REFERENCES customer_table(customer_id) DEFAULT 1,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX ix_workflow_history_agentic_ts ON workflow_history(agentic_id, timestamp);

CREATE TABLE alert_master (
    alert_id BIGSERIAL PRIMARY KEY,
    severity VARCHAR(20) DEFAULT 'Warning',
    is_acknowledged BOOLEAN DEFAULT FALSE,
    is_resolved BOOLEAN DEFAULT FALSE,
    created_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    machine_id TEXT,
    source VARCHAR(100),
    details JSONB,
    customer_id INT REFERENCES customer_table(customer_id) DEFAULT 1,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX ix_alert_master_severity ON alert_master(severity);

CREATE TABLE app_authentication (
    auth_id BIGSERIAL PRIMARY KEY,
    connection_id INT REFERENCES App_connection_table(connection_id) ON DELETE CASCADE,
    auth_type VARCHAR(30),
    username TEXT,
    password_encrypted TEXT,
    api_key TEXT,
    access_token TEXT,
    refresh_token TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX ix_app_auth_conn ON app_authentication(connection_id);

CREATE TABLE database_connection (
    db_connection_id BIGSERIAL PRIMARY KEY,
    connection_id INT REFERENCES App_connection_table(connection_id) ON DELETE CASCADE,
    db_type VARCHAR(30),
    host TEXT,
    port INT,
    database_name TEXT,
    schema_name TEXT,
    username TEXT,
    password_encrypted TEXT,
    ssl_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    customer_id INT REFERENCES customer_table(customer_id) DEFAULT 1
);
CREATE INDEX ix_db_conn_conn ON database_connection(connection_id);

CREATE TABLE schema_registry (
    schema_id BIGSERIAL PRIMARY KEY,
    connection_id INT REFERENCES App_connection_table(connection_id) ON DELETE CASCADE,
    table_name TEXT NOT NULL,
    column_name TEXT NOT NULL,
    data_type TEXT,
    is_primary_key BOOLEAN DEFAULT FALSE,
    is_nullable BOOLEAN DEFAULT TRUE,
    discovered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX ix_schema_registry_table ON schema_registry(table_name);

CREATE TABLE canonical_mapping (
    mapping_id BIGSERIAL PRIMARY KEY,
    schema_id BIGINT REFERENCES schema_registry(schema_id) ON DELETE CASCADE,
    canonical_table TEXT NOT NULL,
    canonical_column TEXT NOT NULL,
    source_table TEXT,
    source_column TEXT,
    confidence_score DECIMAL(5,2) DEFAULT 100.00,
    mapped_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX ix_canonical_mapping_table ON canonical_mapping(canonical_table, canonical_column);

CREATE TABLE tool_table (
    tool_id BIGSERIAL PRIMARY KEY,
    tool_name TEXT NOT NULL UNIQUE,
    description TEXT,
    tool_type VARCHAR(50),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    customer_id INT REFERENCES customer_table(customer_id) DEFAULT 1
);

CREATE TABLE agent_tool_mapping (
    agentic_id VARCHAR(50) REFERENCES agentic_pipline(agentic_id) ON DELETE CASCADE,
    tool_id BIGINT REFERENCES tool_table(tool_id) ON DELETE CASCADE,
    PRIMARY KEY(agentic_id, tool_id)
);

CREATE TABLE pipeline_required_apps (
    agentic_id VARCHAR(50) REFERENCES agentic_pipline(agentic_id) ON DELETE CASCADE,
    app_id VARCHAR(50) REFERENCES app_table(app_id) ON DELETE CASCADE,
    PRIMARY KEY(agentic_id, app_id)
);

CREATE TABLE approval_history (
    approval_id BIGSERIAL PRIMARY KEY,
    workflow_id UUID REFERENCES workflow_history(workflow_id) ON DELETE CASCADE,
    approved_by VARCHAR(50),
    approved_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    remarks TEXT,
    status VARCHAR(20)
);

CREATE TABLE agent_execution_logs (
    execution_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agentic_id VARCHAR(50) REFERENCES agentic_pipline(agentic_id) ON DELETE SET NULL,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(30) DEFAULT 'running',
    execution_time_ms BIGINT,
    error_message TEXT,
    meta JSONB,
    customer_id INT REFERENCES customer_table(customer_id) DEFAULT 1
);
CREATE INDEX ix_agent_exec_agentic_started ON agent_execution_logs(agentic_id, started_at);

CREATE TABLE api_logs (
    log_id BIGSERIAL PRIMARY KEY,
    api_id VARCHAR(50) REFERENCES backend_api_table(api_id) ON DELETE SET NULL,
    request_payload JSONB,
    response_payload JSONB,
    status_code INT,
    latency_ms INT,
    called_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    connection_id INT REFERENCES App_connection_table(connection_id) ON DELETE SET NULL
);
CREATE INDEX ix_api_logs_api_called_at ON api_logs(api_id, called_at);

CREATE TABLE notification_master (
    notification_id BIGSERIAL PRIMARY KEY,
    alert_id BIGINT REFERENCES alert_master(alert_id) ON DELETE SET NULL,
    channel VARCHAR(30),
    recipient TEXT,
    payload JSONB,
    status VARCHAR(20) DEFAULT 'pending',
    sent_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX ix_notification_status ON notification_master(status);

CREATE TABLE connection_health_log (
    health_id BIGSERIAL PRIMARY KEY,
    connection_id INT REFERENCES App_connection_table(connection_id) ON DELETE CASCADE,
    status VARCHAR(30),
    checked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    response_time_ms INT,
    details JSONB
);
CREATE INDEX ix_conn_health_conn_ts ON connection_health_log(connection_id, checked_at);

CREATE TABLE app_version_history (
    version_id BIGSERIAL PRIMARY KEY,
    app_id VARCHAR(50) REFERENCES app_table(app_id) ON DELETE CASCADE,
    old_version VARCHAR(50),
    new_version VARCHAR(50),
    updated_by VARCHAR(50),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE roles (
    role_id SERIAL PRIMARY KEY,
    role_name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT
);

CREATE TABLE user_roles (
    user_id VARCHAR(50) REFERENCES user_table(user_id) ON DELETE CASCADE,
    role_id INT REFERENCES roles(role_id) ON DELETE CASCADE,
    PRIMARY KEY(user_id, role_id)
);

CREATE TABLE oauth_tokens (
    token_id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(50) REFERENCES user_table(user_id) ON DELETE SET NULL,
    provider VARCHAR(50),
    access_token TEXT,
    refresh_token TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    meta JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_appconn_appid ON App_connection_table(app_id);
CREATE INDEX IF NOT EXISTS ix_backendapi_method_endpoint ON backend_api_table(method, end_point);

CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_modtime BEFORE UPDATE ON user_table FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER update_conn_modtime BEFORE UPDATE ON App_connection_table FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER update_pipeline_modtime BEFORE UPDATE ON agentic_pipline FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER update_workflow_history_modtime BEFORE UPDATE ON workflow_history FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER update_alert_master_modtime BEFORE UPDATE ON alert_master FOR EACH ROW EXECUTE FUNCTION update_modified_column();
