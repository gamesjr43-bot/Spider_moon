from flask import Flask
import psycopg2
import os

app = Flask(__name__)

DATABASE_URL = os.getenv("DATABASE_URL")

conn = psycopg2.connect(DATABASE_URL)
cursor = conn.cursor()

cursor.execute("""
CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    nome TEXT
)
""")

conn.commit()

@app.route("/")
def home():

    cursor.execute("""
    INSERT INTO usuarios (nome)
    VALUES ('JR')
    """)

    conn.commit()

    return "Dados salvos no banco!"

if __name__ == "__main__":
    app.run()
