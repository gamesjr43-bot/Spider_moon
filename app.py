from flask import Flask, request, jsonify
from flask_cors import CORS
import psycopg2
import os

app = Flask(__name__)

# ==========================
# LIBERAR GITHUB PAGES
# ==========================

CORS(app)

# ==========================
# CONEXÃO COM NEON
# ==========================

DATABASE_URL = os.getenv("DATABASE_URL")

conn = psycopg2.connect(DATABASE_URL)

cursor = conn.cursor()

# ==========================
# CRIAR TABELAS
# ==========================

cursor.execute("""
CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100)
)
""")

cursor.execute("""
CREATE TABLE IF NOT EXISTS mensagens (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100),
    mensagem TEXT
)
""")

conn.commit()

# ==========================
# HOME
# ==========================

@app.route("/")
def home():
    return "Spider Moon servidor online!"

# ==========================
# CADASTRAR USUÁRIO
# ==========================

@app.route("/registrar", methods=["POST"])
def registrar():

    dados = request.get_json()

    nome = dados["nome"]

    cursor.execute("""
    INSERT INTO usuarios (nome)
    VALUES (%s)
    """, (nome,))

    conn.commit()

    return jsonify({
        "status": "Usuário registrado!"
    })

# ==========================
# ENVIAR MENSAGEM
# ==========================

@app.route("/enviar", methods=["POST"])
def enviar():

    dados = request.get_json()

    nome = dados["nome"]
    mensagem = dados["mensagem"]

    cursor.execute("""
    INSERT INTO mensagens (nome, mensagem)
    VALUES (%s, %s)
    """, (nome, mensagem))

    conn.commit()

    return jsonify({
        "status": "Mensagem enviada!"
    })

# ==========================
# VER MENSAGENS
# ==========================

@app.route("/mensagens")
def mensagens():

    cursor.execute("""
    SELECT * FROM mensagens
    ORDER BY id DESC
    """)

    dados = cursor.fetchall()

    lista = []

    for msg in dados:

        lista.append({
            "id": msg[0],
            "nome": msg[1],
            "mensagem": msg[2]
        })

    return jsonify(lista)

# ==========================
# VER USUÁRIOS
# ==========================

@app.route("/usuarios")
def usuarios():

    cursor.execute("""
    SELECT * FROM usuarios
    ORDER BY id DESC
    """)

    dados = cursor.fetchall()

    lista = []

    for user in dados:

        lista.append({
            "id": user[0],
            "nome": user[1]
        })

    return jsonify(lista)

# ==========================

if __name__ == "__main__":
    app.run()
