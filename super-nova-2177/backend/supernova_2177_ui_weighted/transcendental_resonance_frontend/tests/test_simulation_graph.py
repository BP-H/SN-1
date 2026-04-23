# STRICTLY A SOCIAL MEDIA PLATFORM
# Intellectual Property & Artistic Inspiration
# Legal & Ethical Safeguards

import pytest
pytest.importorskip("nicegui")
pytestmark = pytest.mark.requires_nicegui

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from api_key_input import record_simulation_event
from causal_graph import InfluenceGraph


def test_record_simulation_event_adds_edge():
    session = {}
    graph = record_simulation_event(session, "A", "B", "follow", "2024-01-01T00:00:00")
    assert isinstance(graph, InfluenceGraph)
    assert graph.graph.has_edge("A", "B")
    data = graph.get_edge_data("A", "B")
    assert data["edge_type"] == "follow"


def test_record_simulation_event_appends_list():
    session = {}
    record_simulation_event(session, "A", "B", "follow", "2024-01-01T00:00:00")
    record_simulation_event(session, "B", "C", "like", "2024-01-02T00:00:00")
    graph = session["simulation_graph"]
    assert graph.graph.number_of_edges() == 2
    assert len(session["simulation_events"]) == 2

