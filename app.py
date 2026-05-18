from flask import Flask
import psycopg2
import os

app = Flask(__name__)

DATABASE_URL = os.getenv(postgresql://neondb_owner:npg_zvTPEJZU0s7r@ep-lucky-night-aco9ws1t-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require)

conn = psycopg2.connect(DATABASE_URL)

@app.route("/")
def home():
    return "Servidor funcionando!"

if __name__ == "__main__":
    app.run()
