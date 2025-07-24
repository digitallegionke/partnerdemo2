"use client"

import { useState } from "react"
import { UserPlus, MapPin, CheckCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const deliveries = [
  { id: "DEL-001", location: "Kiambu", status: "pending" },
  { id: "DEL-002", location: "Thika", status: "pending" },
  { id: "DEL-003", location: "Ruiru", status: "pending" },
]

const drivers = [
  { id: "d1", name: "James Ochieng", avatar: "JO" },
  { id: "d2", name: "Sarah Muthoni", avatar: "SM" },
  { id: "d3", name: "David Kiprop", avatar: "DK" },
]

export default function AssignDriversScreen() {
  const [assignments, setAssignments] = useState<Record<string, string>>({})

  const handleAssign = (deliveryId: string, driverId: string) => {
    setAssignments((a) => ({ ...a, [deliveryId]: driverId }))
  }

  return (
    <div className="p-6 bg-white space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 flex items-center">
        <UserPlus className="h-6 w-6 mr-2" />
        Assign Drivers
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {deliveries.map((d) => (
          <Card key={d.id} className="bg-white border border-gray-200">
            <CardHeader>
              <CardTitle className="text-gray-900 flex items-center">
                <MapPin className="h-4 w-4 mr-2 text-gray-500" />
                {d.location}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-900">{d.id}</span>
                <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200">
                  {d.status}
                </Badge>
              </div>

              <Select value={assignments[d.id] ?? ""} onValueChange={(val) => handleAssign(d.id, val)}>
                <SelectTrigger className="w-full bg-white border-gray-300">
                  <SelectValue placeholder="Select driver" />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-200">
                  {drivers.map((driver) => (
                    <SelectItem key={driver.id} value={driver.id}>
                      {driver.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {assignments[d.id] && (
                <div className="flex items-center justify-between text-sm text-green-700">
                  <span className="flex items-center">
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Assigned to {drivers.find((dr) => dr.id === assignments[d.id])?.name}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAssign(d.id, "")}
                    className="border-gray-300 bg-white"
                  >
                    Unassign
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
