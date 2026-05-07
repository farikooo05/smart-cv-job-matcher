import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { ScrollArea } from "./ui/scroll-area";
import { Badge } from "./ui/badge";
import { analysisService, type JobMatch } from "../services/analysis.service";
import { Link } from "react-router-dom";

// Simple relative time formatter
function formatTime(date: Date) {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return date.toLocaleDateString();
}

export function NotificationBell() {
  const [matches, setMatches] = useState<JobMatch[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMatches = async () => {
    try {
      const response = await analysisService.getMatches();
      const recentMatches = response.matches.slice(0, 5);
      setMatches(recentMatches);
      
      // Get last viewed timestamp from storage
      const lastViewed = localStorage.getItem("optijob_notifications_last_viewed");
      const lastViewedTime = lastViewed ? parseInt(lastViewed) : 0;
      
      // Count matches created AFTER the last time the user opened the bell
      const newMatches = response.matches.filter(m => {
        const matchTime = new Date(m.createdAt).getTime();
        return matchTime > lastViewedTime;
      }).length;
      
      setUnreadCount(newMatches);
    } catch (error) {
      console.error("Failed to fetch matches for notification bell", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMatches();
    const interval = setInterval(fetchMatches, 30000); // Poll every 30s for better responsiveness
    return () => clearInterval(interval);
  }, []);

  const handleOpen = () => {
    // Update last viewed timestamp
    localStorage.setItem("optijob_notifications_last_viewed", Date.now().toString());
    setUnreadCount(0);
  };

  return (
    <DropdownMenu onOpenChange={(open) => open && handleOpen()}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="h-5 w-5 text-muted-foreground" />
          {unreadCount > 0 && (
            <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-primary border-2 border-background animate-pulse" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80" align="end">
        <DropdownMenuLabel className="flex items-center justify-between">
          Recent Matches
          {matches.length > 0 && (
            <Badge variant="secondary" className="font-normal">
              {matches.length} total
            </Badge>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ScrollArea className="h-80">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">Loading...</div>
          ) : matches.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No recent job matches found.
            </div>
          ) : (
            <div className="p-1">
              {matches.map((match) => (
                <DropdownMenuItem key={match.id} asChild>
                  <Link 
                    to={`/dashboard/results`} // Link to results page
                    className="flex flex-col items-start gap-1 p-3 cursor-pointer"
                  >
                    <div className="flex w-full items-center justify-between gap-2">
                      <span className="font-medium truncate max-w-[180px]">
                        {match.job.title}
                      </span>
                      <Badge 
                        variant={match.score >= 80 ? "default" : "secondary"}
                        className={match.score >= 80 ? "bg-green-500 hover:bg-green-600" : ""}
                      >
                        {match.score}%
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {match.job.company}
                    </span>
                    <span className="text-[10px] text-muted-foreground mt-1">
                      {formatTime(new Date(match.createdAt))}
                    </span>
                  </Link>
                </DropdownMenuItem>
              ))}
            </div>
          )}
        </ScrollArea>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link 
            to="/dashboard/matches" 
            className="w-full text-center text-xs font-medium text-primary py-2 cursor-pointer"
          >
            View all professional matches
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
