.PHONY: install test lint ui

install:
	python setup_env.py

test:
	pytest -q

lint:
	mypy hypothesis_meta_evaluator.py \
	    causal_trigger.py \
	    introspection/introspection_pipeline.py

ui:
	streamlit run ui.py
