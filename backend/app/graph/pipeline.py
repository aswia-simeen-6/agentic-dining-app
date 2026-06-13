from __future__ import annotations

import structlog
from langgraph.graph import END, StateGraph

from app.agents import discovery, enrich, recommendation, reservation, supervisor
from app.graph.state import PipelineState

log = structlog.get_logger()


def _end_early(state: PipelineState) -> PipelineState:
    """Terminal node when no restaurants are found after enrich."""
    return {
        **state,
        "errors": state["errors"] + ["No restaurants found for your query."],
        "current_step": "end_early",
    }


def _should_continue(state: PipelineState) -> str:
    """Conditional edge: proceed to recommendation only if we have enriched restaurants."""
    if state.get("enriched_restaurants"):
        return "recommendation"
    return "end_early"


def build_graph() -> object:
    """Build and compile the LangGraph pipeline."""
    g: StateGraph = StateGraph(PipelineState)

    g.add_node("supervisor", supervisor.run)
    g.add_node("discovery", discovery.run)
    g.add_node("enrich", enrich.run)
    g.add_node("recommendation", recommendation.run)
    g.add_node("reservation", reservation.run)
    g.add_node("end_early", _end_early)

    g.set_entry_point("supervisor")
    g.add_edge("supervisor", "discovery")
    g.add_edge("discovery", "enrich")
    g.add_conditional_edges("enrich", _should_continue)
    g.add_edge("end_early", END)
    g.add_edge("recommendation", "reservation")
    g.add_edge("reservation", END)

    compiled = g.compile()
    log.info("graph_built")
    return compiled


# Module-level singleton — built once at import / lifespan startup
_graph: object | None = None


def get_graph() -> object:
    """Return the compiled LangGraph graph, building it once if needed."""
    global _graph
    if _graph is None:
        _graph = build_graph()
    return _graph
