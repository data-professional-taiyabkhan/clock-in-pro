import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Alert, AlertDescription } from './ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Clock, 
  MapPin, 
  User, 
  Download,
  Filter,
  RefreshCw,
  Eye
} from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest } from '../lib/queryClient';

interface AuditLog {
  id: number;
  userId: number;
  attemptTime: string;
  verificationType: 'face' | 'pin';
  success: boolean;
  faceConfidence?: number;
  livenessScore?: number;
  locationLatitude?: number;
  locationLongitude?: number;
  deviceInfo?: string;
  failureReason?: string;
  metadata?: any;
}

interface SecurityAlert {
  multipleFailures: any[];
  suspiciousLocations: any[];
  pinUsage: any[];
}

export function SecurityDashboard() {
  const [selectedTab, setSelectedTab] = useState('logs');
  const [filters, setFilters] = useState({
    userId: '',
    verificationType: '',
    success: '',
    startDate: '',
    endDate: '',
    limit: '50'
  });
  const { toast } = useToast();

  // Fetch audit logs
  const { data: auditLogs, refetch: refetchLogs, isLoading: logsLoading } = useQuery({
    queryKey: ['audit-logs', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      
      const response = await apiRequest(`/api/audit-logs?${params.toString()}`);
      return response.logs as AuditLog[];
    },
  });

  // Fetch security alerts
  const { data: securityAlerts, refetch: refetchAlerts, isLoading: alertsLoading } = useQuery({
    queryKey: ['security-alerts'],
    queryFn: async () => {
      const response = await apiRequest('/api/security-alerts');
      return response.alerts as SecurityAlert;
    },
  });

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      userId: '',
      verificationType: '',
      success: '',
      startDate: '',
      endDate: '',
      limit: '50'
    });
  };

  const exportLogs = () => {
    if (!auditLogs || auditLogs.length === 0) {
      toast({
        title: "No Data",
        description: "No logs to export",
        variant: "destructive",
      });
      return;
    }

    const csvContent = [
      ['ID', 'User ID', 'Time', 'Type', 'Success', 'Confidence', 'Liveness', 'Location', 'Device', 'Reason'].join(','),
      ...auditLogs.map(log => [
        log.id,
        log.userId,
        new Date(log.attemptTime).toLocaleString(),
        log.verificationType,
        log.success ? 'Yes' : 'No',
        log.faceConfidence || '',
        log.livenessScore || '',
        log.locationLatitude && log.locationLongitude ? 
          `${log.locationLatitude.toFixed(4)}, ${log.locationLongitude.toFixed(4)}` : '',
        log.deviceInfo ? JSON.parse(log.deviceInfo).userAgent?.substring(0, 50) : '',
        log.failureReason || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `security-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Export Complete",
      description: "Security logs exported successfully",
    });
  };

  const getVerificationTypeIcon = (type: string) => {
    return type === 'face' ? <User className="h-4 w-4" /> : <Shield className="h-4 w-4" />;
  };

  const getSuccessIcon = (success: boolean) => {
    return success ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : (
      <XCircle className="h-4 w-4 text-red-500" />
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Security Dashboard</h2>
          <p className="text-muted-foreground">
            Monitor verification attempts and security events
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { refetchLogs(); refetchAlerts(); }}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={exportLogs}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="logs">Audit Logs</TabsTrigger>
          <TabsTrigger value="alerts">Security Alerts</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Verification Audit Logs
              </CardTitle>
              <CardDescription>
                View all authentication attempts and verification events
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 p-4 border rounded-lg bg-muted/50">
                <div className="space-y-2">
                  <Label htmlFor="userId">User ID</Label>
                  <Input
                    id="userId"
                    placeholder="User ID"
                    value={filters.userId}
                    onChange={(e) => handleFilterChange('userId', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="verificationType">Type</Label>
                  <Select value={filters.verificationType} onValueChange={(value) => handleFilterChange('verificationType', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All types</SelectItem>
                      <SelectItem value="face">Face</SelectItem>
                      <SelectItem value="pin">PIN</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="success">Status</Label>
                  <Select value={filters.success} onValueChange={(value) => handleFilterChange('success', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="All status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All status</SelectItem>
                      <SelectItem value="true">Success</SelectItem>
                      <SelectItem value="false">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => handleFilterChange('startDate', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => handleFilterChange('endDate', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="limit">Limit</Label>
                  <Select value={filters.limit} onValueChange={(value) => handleFilterChange('limit', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                      <SelectItem value="200">200</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="flex justify-between items-center">
                <Button variant="outline" onClick={clearFilters}>
                  <Filter className="h-4 w-4 mr-2" />
                  Clear Filters
                </Button>
                <div className="text-sm text-muted-foreground">
                  {auditLogs?.length || 0} logs found
                </div>
              </div>

              {/* Logs Table */}
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Confidence</TableHead>
                      <TableHead>Liveness</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Device</TableHead>
                      <TableHead>Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logsLoading ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8">
                          Loading logs...
                        </TableCell>
                      </TableRow>
                    ) : auditLogs && auditLogs.length > 0 ? (
                      auditLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4" />
                              {new Date(log.attemptTime).toLocaleString()}
                            </div>
                          </TableCell>
                          <TableCell>User {log.userId}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getVerificationTypeIcon(log.verificationType)}
                              <Badge variant={log.verificationType === 'face' ? 'default' : 'secondary'}>
                                {log.verificationType.toUpperCase()}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getSuccessIcon(log.success)}
                              <Badge variant={log.success ? 'default' : 'destructive'}>
                                {log.success ? 'Success' : 'Failed'}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            {log.faceConfidence ? `${log.faceConfidence.toFixed(1)}%` : '-'}
                          </TableCell>
                          <TableCell>
                            {log.livenessScore ? `${log.livenessScore.toFixed(1)}%` : '-'}
                          </TableCell>
                          <TableCell>
                            {log.locationLatitude && log.locationLongitude ? (
                              <div className="flex items-center gap-1 text-xs">
                                <MapPin className="h-3 w-3" />
                                {log.locationLatitude.toFixed(4)}, {log.locationLongitude.toFixed(4)}
                              </div>
                            ) : '-'}
                          </TableCell>
                          <TableCell className="max-w-32 truncate">
                            {log.deviceInfo ? JSON.parse(log.deviceInfo).browser : '-'}
                          </TableCell>
                          <TableCell className="max-w-32 truncate">
                            {log.failureReason || '-'}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8">
                          No logs found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <div className="grid gap-4">
            {/* Multiple Failures Alert */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  Multiple Failed Attempts
                </CardTitle>
                <CardDescription>
                  Users with 3+ failed verification attempts in the last 24 hours
                </CardDescription>
              </CardHeader>
              <CardContent>
                {alertsLoading ? (
                  <div className="text-center py-4">Loading alerts...</div>
                ) : securityAlerts?.multipleFailures && securityAlerts.multipleFailures.length > 0 ? (
                  <div className="space-y-2">
                    {securityAlerts.multipleFailures.map((failure, index) => (
                      <Alert key={index} variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          User {failure.userId} has {failure.failureCount} failed attempts since {new Date(failure.lastAttempt).toLocaleString()}
                        </AlertDescription>
                      </Alert>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    No multiple failure alerts
                  </div>
                )}
              </CardContent>
            </Card>

            {/* PIN Usage Alert */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-blue-500" />
                  PIN Usage
                </CardTitle>
                <CardDescription>
                  Recent PIN authentication usage (managers should be notified)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {securityAlerts?.pinUsage && securityAlerts.pinUsage.length > 0 ? (
                  <div className="space-y-2">
                    {securityAlerts.pinUsage.map((pinUsage, index) => (
                      <Alert key={index}>
                        <Shield className="h-4 w-4" />
                        <AlertDescription>
                          User {pinUsage.userId} used PIN authentication on {new Date(pinUsage.attemptTime).toLocaleString()}
                        </AlertDescription>
                      </Alert>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    No recent PIN usage
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Suspicious Locations */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-purple-500" />
                  Suspicious Location Patterns
                </CardTitle>
                <CardDescription>
                  Users accessing from multiple different locations
                </CardDescription>
              </CardHeader>
              <CardContent>
                {securityAlerts?.suspiciousLocations && securityAlerts.suspiciousLocations.length > 0 ? (
                  <div className="space-y-2">
                    {securityAlerts.suspiciousLocations.map((location, index) => (
                      <Alert key={index} variant="destructive">
                        <MapPin className="h-4 w-4" />
                        <AlertDescription>
                          User {location.userId} accessed from {location.locationCount} different locations since {new Date(location.lastAttempt).toLocaleString()}
                        </AlertDescription>
                      </Alert>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    No suspicious location patterns
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Attempts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{auditLogs?.length || 0}</div>
                <p className="text-xs text-muted-foreground">Last 24 hours</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {auditLogs && auditLogs.length > 0 
                    ? `${((auditLogs.filter(log => log.success).length / auditLogs.length) * 100).toFixed(1)}%`
                    : '0%'
                  }
                </div>
                <p className="text-xs text-muted-foreground">Face verification</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">PIN Usage</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {auditLogs?.filter(log => log.verificationType === 'pin').length || 0}
                </div>
                <p className="text-xs text-muted-foreground">Backup authentications</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
