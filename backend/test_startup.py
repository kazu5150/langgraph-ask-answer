#!/usr/bin/env python3
"""
Renderデプロイのテスト用ファイル
依存関係やインポートの問題を診断
"""

print("=== Backend Startup Test ===")

try:
    print("Testing Python imports...")
    import sys
    print(f"Python version: {sys.version}")

    print("Testing basic imports...")
    import os
    import re
    print("✓ Standard library imports OK")

    print("Testing FastAPI...")
    from fastapi import FastAPI
    print("✓ FastAPI import OK")

    print("Testing pydantic...")
    from pydantic import BaseModel
    print("✓ Pydantic import OK")

    print("Testing LangChain...")
    from langchain_openai import ChatOpenAI
    from langchain_core.prompts import ChatPromptTemplate
    print("✓ LangChain imports OK")

    print("Testing image processing...")
    from PIL import Image
    print("✓ PIL (Pillow) import OK")

    print("Testing multipart...")
    import fastapi.multipart
    print("✓ python-multipart OK")

    print("Testing main module...")
    import main
    print("✓ Main module import OK")

    print("Testing FastAPI app creation...")
    app = main.app
    print(f"✓ FastAPI app created: {app}")

    print("\n=== All tests passed! ===")
    print("The backend should work correctly on Render.")

except ImportError as e:
    print(f"❌ Import error: {e}")
    print("Missing dependency detected!")
except Exception as e:
    print(f"❌ Error: {e}")
    print("Other issue detected!")