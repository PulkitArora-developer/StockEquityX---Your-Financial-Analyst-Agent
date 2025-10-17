FROM arm64v8/python:3.12-slim

WORKDIR /app

RUN apt-get update

RUN apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY .. .

RUN pip install --no-cache-dir -r requirements.txt

EXPOSE 8080
EXPOSE 8000
EXPOSE 9000

CMD ["python", "agent.py"]