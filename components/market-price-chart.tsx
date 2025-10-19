"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip } from "@/components/ui/chart"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend } from "recharts"
import { format } from "date-fns"
import { TrendingUp } from "lucide-react"

interface PriceHistoryPoint {
  timestamp: string
  yes_probability: number
  no_probability: number
  total_volume: number
}

interface MarketPriceChartProps {
  marketId: string
}

export function MarketPriceChart({ marketId }: MarketPriceChartProps) {
  const [priceHistory, setPriceHistory] = useState<PriceHistoryPoint[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadPriceHistory = async () => {
      setIsLoading(true)

      try {
        const response = await fetch(`/api/market-price-history?marketId=${marketId}`, {
          cache: "no-store",
        })
        if (!response.ok) throw new Error("Failed to fetch price history")

        const data = await response.json()
        setPriceHistory(data)
      } catch (error) {
        console.error("Error loading price history:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadPriceHistory()
  }, [marketId])

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Price History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">Loading chart...</div>
        </CardContent>
      </Card>
    )
  }

  if (priceHistory.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Price History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
            No price history available yet
          </div>
        </CardContent>
      </Card>
    )
  }

  // Format data for chart
  const chartData = priceHistory.map((point) => ({
    time: format(new Date(point.timestamp), "MMM d, HH:mm"),
    fullTime: format(new Date(point.timestamp), "MMM d, yyyy HH:mm"),
    YES: (point.yes_probability * 100).toFixed(1),
    NO: (point.no_probability * 100).toFixed(1),
    volume: Number.parseFloat(point.total_volume.toString()).toFixed(2),
  }))

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Price History
          </CardTitle>
          <p className="text-sm text-muted-foreground">Probability changes over time</p>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={{
            YES: {
              label: "YES",
              color: "hsl(142, 76%, 36%)",
            },
            NO: {
              label: "NO",
              color: "hsl(0, 84%, 60%)",
            },
          }}
          className="h-[200px] w-full"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="time" tick={{ fontSize: 12 }} tickLine={false} />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 12 }}
                tickLine={false}
                label={{ value: "Probability (%)", angle: -90, position: "insideLeft", style: { fontSize: 12 } }}
              />
              <ChartTooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null

                  return (
                    <div className="rounded-lg border bg-background p-2 shadow-sm">
                      <div className="text-xs font-medium mb-1">{payload[0]?.payload?.fullTime}</div>
                      <div className="grid gap-1">
                        {payload.map((entry: any) => (
                          <div key={entry.name} className="flex items-center gap-2 text-xs">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                            <span className="font-medium">{entry.name}:</span>
                            <span>{entry.value}%</span>
                          </div>
                        ))}
                        <div className="text-xs text-muted-foreground mt-1 pt-1 border-t">
                          Volume: ${payload[0]?.payload?.volume}
                        </div>
                      </div>
                    </div>
                  )
                }}
              />
              <Legend wrapperStyle={{ fontSize: "12px" }} iconType="line" />
              <Line
                type="monotone"
                dataKey="YES"
                stroke="var(--color-YES)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="NO"
                stroke="var(--color-NO)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
