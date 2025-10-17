from bedrock_agentcore_starter_toolkit import Runtime
from boto3.session import Session
boto_session = Session()
region = boto_session.region_name

agentcore_runtime = Runtime()
agent_name = "financial_analyst_agent"
response = agentcore_runtime.configure(
    entrypoint="agent.py",
    auto_create_execution_role=True,
    auto_create_ecr=True,
    requirements_file="../requirements.txt",
    region=region,
    agent_name=agent_name
)


launch_result = agentcore_runtime.launch()

import time
status_response = agentcore_runtime.status()
status = status_response.endpoint['status']
end_status = ['READY', 'CREATE_FAILED', 'DELETE_FAILED', 'UPDATE_FAILED']
while status not in end_status:
    time.sleep(10)
    status_response = agentcore_runtime.status()
    status = status_response.endpoint['status']
    print(status)