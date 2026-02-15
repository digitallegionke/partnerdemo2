"""
Google OR-Tools Vehicle Routing Problem (VRP) solver.

Solves capacitated VRP with optional time windows using OR-Tools.
Designed for urban delivery routes in Nairobi (typically 5-30 stops).
"""

import time
from ortools.constraint_solver import routing_enums_pb2, pywrapcp
from models import VrpRequest, VrpResponse, RouteSolution


def solve_vrp(request: VrpRequest) -> VrpResponse:
    """Solve the VRP and return optimized routes."""
    start_time = time.time()

    n = len(request.distance_matrix)
    num_vehicles = request.num_vehicles
    depot = request.depot_index

    # Create the routing index manager
    manager = pywrapcp.RoutingIndexManager(n, num_vehicles, depot)
    routing = pywrapcp.RoutingModel(manager)

    # --- Distance callback ---
    def distance_callback(from_index, to_index):
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        return request.distance_matrix[from_node][to_node]

    transit_callback_index = routing.RegisterTransitCallback(distance_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

    # --- Capacity constraints ---
    def demand_callback(from_index):
        from_node = manager.IndexToNode(from_index)
        return request.demands[from_node]

    demand_callback_index = routing.RegisterUnaryTransitCallback(demand_callback)
    routing.AddDimensionWithVehicleCapacity(
        demand_callback_index,
        0,                              # no slack
        request.vehicle_capacities,     # max capacity per vehicle
        True,                           # start cumul to zero
        'Capacity'
    )

    # --- Time dimension (for duration limits and time windows) ---
    def time_callback(from_index, to_index):
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        # Travel time + 5 minutes service time per stop
        return request.time_matrix[from_node][to_node] + 300

    time_callback_index = routing.RegisterTransitCallback(time_callback)
    max_duration = request.max_route_duration or (8 * 3600)  # default 8 hours
    routing.AddDimension(
        time_callback_index,
        1800,           # 30 min max waiting time (slack)
        max_duration,   # max time per vehicle
        False,          # don't force start cumul to zero
        'Time'
    )
    time_dimension = routing.GetDimensionOrDie('Time')

    # --- Time windows (if provided) ---
    if request.time_windows:
        for node_idx, tw in enumerate(request.time_windows):
            if tw is not None and node_idx != depot:
                index = manager.NodeToIndex(node_idx)
                time_dimension.CumulVar(index).SetRange(tw[0], tw[1])

    # --- Allow dropping nodes with a penalty ---
    # High penalty to discourage dropping, but allows feasible solutions
    penalty = 100_000
    for node in range(n):
        if node == depot:
            continue
        routing.AddDisjunction([manager.NodeToIndex(node)], penalty)

    # --- Search parameters ---
    search_params = pywrapcp.DefaultRoutingSearchParameters()
    search_params.first_solution_strategy = (
        routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    )
    search_params.local_search_metaheuristic = (
        routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    )
    search_params.time_limit.FromSeconds(30)  # 30 sec max

    # --- Solve ---
    solution = routing.SolveWithParameters(search_params)
    elapsed_ms = int((time.time() - start_time) * 1000)

    if not solution:
        return VrpResponse(
            solutions=[],
            dropped_nodes=request.delivery_ids[1:],  # all except depot
            objective_value=0,
            computation_time_ms=elapsed_ms,
            status='no_solution'
        )

    # --- Extract solution ---
    solutions = []
    all_visited = set()

    for vehicle_id in range(num_vehicles):
        route_nodes = []
        route_delivery_ids = []
        index = routing.Start(vehicle_id)

        while not routing.IsEnd(index):
            node = manager.IndexToNode(index)
            if node != depot:
                route_nodes.append(node)
                route_delivery_ids.append(request.delivery_ids[node])
                all_visited.add(node)
            index = solution.Value(routing.NextVar(index))

        if not route_nodes:
            continue

        # Calculate route metrics
        total_dist = 0
        total_time = 0
        prev = depot
        for node in route_nodes:
            total_dist += request.distance_matrix[prev][node]
            total_time += request.time_matrix[prev][node] + 300  # +5min service
            prev = node
        # Return to depot
        total_dist += request.distance_matrix[prev][depot]
        total_time += request.time_matrix[prev][depot]

        solutions.append(RouteSolution(
            vehicle_index=vehicle_id,
            ordered_node_indices=route_nodes,
            ordered_delivery_ids=route_delivery_ids,
            total_distance_m=total_dist,
            total_duration_s=total_time,
        ))

    # Find dropped nodes
    dropped = []
    for node in range(n):
        if node != depot and node not in all_visited:
            dropped.append(request.delivery_ids[node])

    status = 'optimal' if routing.status() == 1 else 'feasible'

    return VrpResponse(
        solutions=solutions,
        dropped_nodes=dropped,
        objective_value=solution.ObjectiveValue(),
        computation_time_ms=elapsed_ms,
        status=status,
    )
