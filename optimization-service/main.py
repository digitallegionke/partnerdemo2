"""
Roundi Optimization Service - FastAPI app wrapping Google OR-Tools VRP solver.

Run with: uvicorn main:app --host 0.0.0.0 --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from models import VrpRequest, VrpResponse
from vrp_solver import solve_vrp

app = FastAPI(
    title="Roundi Optimization Service",
    description="Vehicle Routing Problem solver powered by Google OR-Tools",
    version="1.0.0",
)

# Allow CORS from the Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    """Health check endpoint."""
    return {"status": "ok", "service": "roundi-optimization"}


@app.post("/solve", response_model=VrpResponse)
async def solve(request: VrpRequest):
    """
    Solve a Vehicle Routing Problem.

    Accepts a distance/time matrix with constraints and returns
    optimized route assignments for each vehicle.
    """
    return solve_vrp(request)
