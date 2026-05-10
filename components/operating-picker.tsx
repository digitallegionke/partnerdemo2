import { useState } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

const daysOfWeek = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export default function OperatingHoursSelector() {
  const [preset, setPreset] = useState<string>("9_5");
  const [customHours, setCustomHours] = useState(
    daysOfWeek.map((day) => ({
      day,
      open: "09:00",
      close: "17:00",
      closed: false,
    }))
  );

  const updateDay = (index: number, field: string, value: string | boolean) => {
    const updated = [...customHours];
    // @ts-ignore
    updated[index][field] = value;
    setCustomHours(updated);
  };

  return (
    <div className="space-y-4">
      <Label>Operating Hours *</Label>
      <Select value={preset} onValueChange={setPreset}>
        <SelectTrigger>
          <SelectValue placeholder="Select operating hours" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="9_5">9 AM – 5 PM</SelectItem>
          <SelectItem value="8_5">8 AM – 5 PM</SelectItem>
          <SelectItem value="half_day">Half Day (8 AM – 12 PM)</SelectItem>
          <SelectItem value="24_hours">24 Hours</SelectItem>
          <SelectItem value="custom">Custom</SelectItem>
        </SelectContent>
      </Select>

      {preset === "custom" && (
        <div className="space-y-3 border p-4 rounded-lg bg-blue-50">
          {customHours.map((day, idx) => (
            <div key={day.day} className="flex items-center gap-3">
              <Checkbox
                checked={day.closed}
                onCheckedChange={(val) => updateDay(idx, "closed", !!val)}
              />
              <span className="w-24">{day.day}</span>
              {!day.closed && (
                <div className="flex items-center gap-2">
                  <Input
                    type="time"
                    value={day.open}
                    onChange={(e) => updateDay(idx, "open", e.target.value)}
                  />
                  <span>-</span>
                  <Input
                    type="time"
                    value={day.close}
                    onChange={(e) => updateDay(idx, "close", e.target.value)}
                  />
                </div>
              )}
              {day.closed && (
                <span className="text-sm text-gray-500">Closed</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}