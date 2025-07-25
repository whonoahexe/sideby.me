'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, Crown, User } from 'lucide-react';
import { User as UserType } from '@/types';

interface UserListProps {
  users: UserType[];
  currentUserId: string;
  currentUserIsHost?: boolean;
  onPromoteUser?: (userId: string) => void;
  className?: string;
}

export function UserList({
  users,
  currentUserId,
  currentUserIsHost,
  onPromoteUser,
  className,
}: UserListProps) {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const sortedUsers = [...users].sort((a, b) => {
    // Host first, then alphabetical
    if (a.isHost !== b.isHost) {
      return a.isHost ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center space-x-2">
          <Users className="h-5 w-5" />
          <span>Participants</span>
          <Badge variant="secondary" className="ml-auto">
            {users.length}
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent>
        <div className="space-y-3">
          {sortedUsers.map(user => (
            <div
              key={user.id}
              className={`flex items-center space-x-3 rounded-lg p-2 transition-colors ${
                user.id === currentUserId
                  ? 'border border-primary/20 bg-primary/10'
                  : 'hover:bg-muted/50'
              }`}
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs">{getInitials(user.name)}</AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1">
                <div className="flex items-center space-x-2">
                  <span className="truncate text-sm font-medium">
                    {user.name}
                    {user.id === currentUserId && (
                      <span className="ml-1 text-muted-foreground">(You)</span>
                    )}
                  </span>
                  {user.isHost && <Crown className="h-3 w-3 flex-shrink-0 text-yellow-500" />}
                </div>

                <div className="mt-1 flex items-center space-x-1">
                  <User className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {user.isHost ? 'Host' : 'Guest'}
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {/* Promote button for hosts to promote guests */}
                {currentUserIsHost &&
                  !user.isHost &&
                  user.id !== currentUserId &&
                  onPromoteUser && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onPromoteUser(user.id)}
                      className="h-6 px-2 text-xs"
                      title={`Promote ${user.name} to host`}
                    >
                      <Crown className="h-3 w-3" />
                    </Button>
                  )}

                <div className="h-2 w-2 rounded-full bg-green-500" title="Online" />
              </div>
            </div>
          ))}

          {users.length === 0 && (
            <div className="py-4 text-center text-muted-foreground">
              <Users className="mx-auto mb-2 h-8 w-8 opacity-50" />
              <p>No participants yet</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
