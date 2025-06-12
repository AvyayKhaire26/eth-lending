@echo off
echo Setting up ML environment...
python -m venv ml-env
ml-env\Scripts\activate
pip install -r requirements.txt
echo ML environment setup complete!
pause
