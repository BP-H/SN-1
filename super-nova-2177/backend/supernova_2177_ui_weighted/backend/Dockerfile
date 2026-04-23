# Usa uma imagem oficial do Python
FROM python:3.12-slim

# Define o diretório de trabalho
WORKDIR /app

# Copia o requirements (se tiveres) e instala dependências
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copia todo o código da app para dentro do container
COPY . .

# Expõe a porta 8000 para o FastAPI
EXPOSE 8000

# Comando para iniciar a FastAPI
CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT:-8000}"]
