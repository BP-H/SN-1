# STRICTLY A SOCIAL MEDIA PLATFORM
# Intellectual Property & Artistic Inspiration
# Legal & Ethical Safeguards

# Contributing

Thank you for your interest in improving this project! The notes below cover how to set up the testing environment.

## Running the Tests

Install the minimal dependencies first:

```bash
pip install -r requirements-minimal.txt
```

Some UI tests rely on optional packages. Install `streamlit` (already listed in `requirements.txt`) and [`nicegui`](https://github.com/zauberzeug/nicegui) if you want to run every test:

```bash
pip install streamlit nicegui
```

The test suite automatically skips UI tests when these packages are missing.

After installing the packages, run:

```bash
pytest
```

We welcome pull requests that follow these guidelines.
