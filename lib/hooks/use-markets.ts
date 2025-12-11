"use client"

import useSWR from "swr"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export function useMarkets() {
  const { data, error, isLoading, mutate } = useSWR("/api/markets", fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 300000, // Cache for 5 minutes (increased from 1 minute)
    keepPreviousData: true, // Show cached data immediately while revalidating
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
    dedupingInterval: 300000, // Cache for 5 minutes (increased from 30 seconds)
    keepPreviousData: true,
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
    dedupingInterval: 300000, // Cache for 5 minutes (increased from 1 minute)
    keepPreviousData: true,
  })

  return {
    profile: data?.profile,
    stats: data?.stats,
    isLoading,
    error,
    mutate,
  }
}
