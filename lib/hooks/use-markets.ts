"use client"

import useSWR from "swr"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export function useMarkets() {
  const { data, error, isLoading, mutate } = useSWR("/api/markets", fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 60000, // Cache for 1 minute
  })

  console.log("[v0] useMarkets hook - Raw data from SWR:", {
    hasData: !!data,
    markets: data?.markets?.length || 0,
    privateMarkets: data?.privateMarkets?.length || 0,
    createdMarkets: data?.createdMarkets?.length || 0,
    isLoading,
    error: error?.message,
  })

  return {
    markets: data?.markets || [],
    privateMarkets: data?.privateMarkets || [],
    createdMarkets: data?.createdMarkets || [],
    totalVolume: data?.totalVolume || 0,
    activeMarkets: data?.activeMarkets || 0,
    isLoading,
    error,
    mutate,
  }
}

export function useMyBets() {
  const { data, error, isLoading, mutate } = useSWR("/api/my-bets", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30000, // Cache for 30 seconds
  })

  return {
    positions: data?.positions || [],
    createdMarkets: data?.createdMarkets || [],
    privateMarkets: data?.privateMarkets || [],
    pnlHistory: data?.pnlHistory || [],
    isLoading,
    error,
    mutate,
  }
}

export function useProfile() {
  const { data, error, isLoading, mutate } = useSWR("/api/profile", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  })

  return {
    profile: data?.profile,
    stats: data?.stats,
    isLoading,
    error,
    mutate,
  }
}
