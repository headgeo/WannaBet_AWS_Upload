"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Bell, TrendingUp, TrendingDown, DollarSign, Users, ChevronDown, ChevronUp } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import Link from "next/link"
import { getNotifications, markNotificationsAsRead } from "@/app/actions/notifications"

interface Notification {
  id: string
  market_id: string
  type: string
  title: string
  message: string
  is_read: boolean
  created_at: string
  user_id: string
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [expandedNotifications, setExpandedNotifications] = useState<Set<string>>(new Set())
  const popupRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const unreadCount = notifications.filter((n) => !n.is_read).length

  useEffect(() => {
    loadNotifications()
  }, [])

  const loadNotifications = async () => {
    try {
      const data = await getNotifications()
      setNotifications(data || [])
    } catch (error) {
      console.error("Error loading notifications:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popupRef.current &&
        buttonRef.current &&
        !popupRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen])

  const markAllAsRead = async () => {
    try {
      const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id)

      if (unreadIds.length === 0) return

      await markNotificationsAsRead(unreadIds)

      // Update local state
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    } catch (error) {
      console.error("Error marking notifications as read:", error)
    }
  }

  const getNotificationIcon = (notification: Notification) => {
    if (notification.type === "settlement") {
      return notification.title.includes("Won") ? (
        <TrendingUp className="w-4 h-4 text-green-600" />
      ) : notification.title.includes("Fees") ? (
        <DollarSign className="w-4 h-4 text-blue-600" />
      ) : (
        <TrendingDown className="w-4 h-4 text-red-600" />
      )
    }
    if (notification.type === "trade") {
      return <TrendingUp className="w-4 h-4 text-blue-600" />
    }
    if (notification.type === "new_market") {
      return <Users className="w-4 h-4 text-purple-600" />
    }
    return <Bell className="w-4 h-4" />
  }

  const handleToggle = () => {
    const newIsOpen = !isOpen
    setIsOpen(newIsOpen)

    if (newIsOpen && unreadCount > 0) {
      markAllAsRead()
    }
  }

  const toggleNotificationExpansion = (notificationId: string) => {
    setExpandedNotifications((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(notificationId)) {
        newSet.delete(notificationId)
      } else {
        newSet.add(notificationId)
      }
      return newSet
    })
  }

  return (
    <div className="relative">
      <Button ref={buttonRef} variant="ghost" size="sm" className="relative" onClick={handleToggle}>
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <Badge
            variant="destructive"
            className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </Badge>
        )}
      </Button>

      {isOpen && (
        <div
          ref={popupRef}
          className="absolute right-4 md:left-auto md:right-0 top-full mt-2 w-[calc(100vw-5rem)] max-w-[220px] md:max-w-none md:w-96 z-50"
          style={{ maxHeight: "calc(100vh - 100px)" }}
        >
          <Card className="shadow-lg border">
            <CardHeader className="pb-2 md:pb-3 px-3 md:px-6 pt-3 md:pt-6">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base md:text-lg">Notifications</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[300px] md:h-[400px]">
                {isLoading ? (
                  <div className="text-center py-8 px-4">
                    <p className="text-xs md:text-sm text-muted-foreground">Loading notifications...</p>
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="text-center py-8 px-4">
                    <Bell className="w-6 h-6 md:w-8 md:h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-xs md:text-sm text-muted-foreground">No notifications yet</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {notifications.map((notification) => {
                      const isExpanded = expandedNotifications.has(notification.id)
                      const isLongMessage = notification.message.length > 100

                      return (
                        <div
                          key={notification.id}
                          className="p-1.5 md:p-2 border-b last:border-b-0 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-start gap-2">
                            <div className="flex-shrink-0 mt-0.5">{getNotificationIcon(notification)}</div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1">
                                  <p className="text-xs md:text-sm font-medium leading-tight">{notification.title}</p>
                                  <p
                                    className={`text-[11px] md:text-xs text-muted-foreground mt-0.5 ${isExpanded ? "" : "line-clamp-2"}`}
                                  >
                                    {notification.message}
                                  </p>
                                  {isLongMessage && (
                                    <button
                                      onClick={() => toggleNotificationExpansion(notification.id)}
                                      className="text-[11px] md:text-xs text-blue-600 hover:text-blue-700 mt-0.5 flex items-center gap-1"
                                    >
                                      {isExpanded ? (
                                        <>
                                          Show less <ChevronUp className="w-3 h-3" />
                                        </>
                                      ) : (
                                        <>
                                          Show more <ChevronDown className="w-3 h-3" />
                                        </>
                                      )}
                                    </button>
                                  )}
                                  <div className="flex items-center gap-2 mt-1">
                                    <p className="text-[11px] md:text-xs text-muted-foreground">
                                      {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                                    </p>
                                    <Link
                                      href={`/market/${notification.market_id}`}
                                      className="text-[11px] md:text-xs text-blue-600 hover:text-blue-700"
                                      onClick={() => setIsOpen(false)}
                                    >
                                      View Market
                                    </Link>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
