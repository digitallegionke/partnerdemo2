from pydantic import BaseModel
from typing import Optional


class VrpRequest(BaseModel):
    """Request body for the VRP solver."""
    distance_matrix: list[list[int]]      # NxN matrix in meters
    time_matrix: list[list[int]]          # NxN matrix in seconds
    demands: list[int]                     # demand at each node (0 for depot)
    vehicle_capacities: list[int]          # capacity per vehicle
    time_windows: Optional[list[Optional[list[int]]]] = None  # [[start_s, end_s], ...] or None
    num_vehicles: int
    depot_index: int = 0
    max_route_duration: Optional[int] = None  # max seconds per route
    delivery_ids: list[int]                # maps matrix indices to delivery IDs
    node_labels: Optional[list[str]] = None  # human-readable labels for logging


class RouteSolution(BaseModel):
    """Solution for a single vehicle route."""
    vehicle_index: int
    ordered_node_indices: list[int]
    ordered_delivery_ids: list[int]
    total_distance_m: int
    total_duration_s: int


class VrpResponse(BaseModel):
    """Response from the VRP solver."""
    solutions: list[RouteSolution]
    dropped_nodes: list[int]              # delivery IDs that couldn't be assigned
    objective_value: int
    computation_time_ms: int
    status: str                           # 'optimal', 'feasible', 'no_solution'
