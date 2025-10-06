import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Users, UserPlus, Clock, MapPin, Calendar, Upload, Building2, UserCheck, LogOut, BarChart3, Key } from "lucide-react";
import type { User, AttendanceRecord, Location, EmployeeInvitation, EmployeeLocation } from "@shared/schema";
import { format } from "date-fns";
import { ManagerAnalyticsDashboard } from "@/components/manager-analytics-dashboard";
import { ChangePasswordDialog } from "@/components/change-password-dialog";

export default function ManagerDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);
  const [isAddEmployeeOpen, setIsAddEmployeeOpen] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [newEmployee, setNewEmployee] = useState({
    firstName: '',
    lastName: '',
    email: '',
    role: 'employee'
  });

  const { data: user } = useQuery({
    queryKey: ["/api/user"],
    queryFn: () => apiRequest("/api/user"),
  });

  const { data: employees = [], isLoading: employeesLoading, error: employeesError } = useQuery({
    queryKey: ["/api/employees"],
    queryFn: () => apiRequest("/api/employees"),
  });

  const { data: locations = [], isLoading: locationsLoading } = useQuery({
    queryKey: ["/api/locations"],
    queryFn: () => apiRequest("/api/locations"),
  });

  const { data: employeeLocations = [], isLoading: assignmentsLoading } = useQuery({
    queryKey: ["/api/employee-locations"],
    queryFn: () => apiRequest("/api/employee-locations"),
  });

  const { data: attendanceRecords = [] } = useQuery({
    queryKey: ["/api/attendance"],
    queryFn: () => apiRequest("/api/attendance"),
  });

  const { data: invitations = [] } = useQuery({
    queryKey: ["/api/invitations"],
    queryFn: () => apiRequest("/api/invitations"),
  });

  const assignLocationMutation = useMutation({
    mutationFn: async ({ userId, locationId }: { userId: number; locationId: number }) => {
      return await apiRequest("/api/employee-locations", {
        method: "POST",
        body: JSON.stringify({ userId, locationId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employee-locations"] });
      setSelectedEmployeeId(null);
      setSelectedLocationId(null);
      toast({
        title: "Success",
        description: "Employee assigned to location successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const removeLocationMutation = useMutation({
    mutationFn: async ({ userId, locationId }: { userId: number; locationId: number }) => {
      return await apiRequest(`/api/employee-locations/${userId}/${locationId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employee-locations"] });
      toast({
        title: "Success",
        description: "Employee removed from location",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateFaceMutation = useMutation({
    mutationFn: async ({ employeeId, imageData }: { employeeId: number; imageData: string }) => {
      return await apiRequest(`/api/employees/${employeeId}/face-image`, {
        method: "POST",
        body: JSON.stringify({ imageData }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({
        title: "Success",
        description: "Employee face image updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/logout", { method: "POST" });
    },
    onSuccess: () => {
      queryClient.clear();
      window.location.href = "/";
    },
  });

  const createEmployeeMutation = useMutation({
    mutationFn: async (employeeData: {
      firstName: string;
      lastName: string;
      email: string;
      role: string;
    }) => {
      return await apiRequest("/api/employees", {
        method: "POST",
        body: JSON.stringify(employeeData),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      setIsAddEmployeeOpen(false);
      setNewEmployee({
        firstName: '',
        lastName: '',
        email: '',
        role: 'employee'
      });
      toast({
        title: "Success",
        description: "Employee created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleUpdateFace = (employeeId: number) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const imageData = event.target?.result as string;
          updateFaceMutation.mutate({ employeeId, imageData });
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Manager Dashboard</h1>
            <p className="text-gray-600 dark:text-gray-300 mt-2">
              Welcome back, {user?.firstName} {user?.lastName}
            </p>
            <div className="flex gap-4 mt-2">
              <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
                {employees.length} Total Employees
              </span>
              <span className="text-sm bg-green-100 text-green-800 px-2 py-1 rounded">
                {locations.length} Office Locations
              </span>
              <span className="text-sm bg-purple-100 text-purple-800 px-2 py-1 rounded">
                {employeeLocations.length} Location Assignments
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowPasswordDialog(true)}>
              <Key className="w-4 h-4 mr-2" />
              Change Password
            </Button>
            <Button variant="outline" onClick={() => logoutMutation.mutate()}>
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="assignments" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="assignments">Location Assignments</TabsTrigger>
            <TabsTrigger value="employees">Employees</TabsTrigger>
            <TabsTrigger value="locations">Locations</TabsTrigger>
            <TabsTrigger value="attendance">Attendance</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="invitations">Invitations</TabsTrigger>
          </TabsList>

          {/* Location Assignments Tab */}
          <TabsContent value="assignments">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  Employee Location Assignments
                </CardTitle>
                <CardDescription>
                  Assign employees to office locations where they can check in
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Assignment Form */}
                  <div className="border rounded-lg p-6 bg-gray-50 dark:bg-gray-800">
                    <h3 className="font-medium mb-4 text-lg">Assign Employee to Location</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="employee-select">Select Employee</Label>
                        <Select 
                          value={selectedEmployeeId?.toString() || ""} 
                          onValueChange={(value) => setSelectedEmployeeId(parseInt(value))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Choose an employee..." />
                          </SelectTrigger>
                          <SelectContent>
                            {employees.filter((emp: User) => emp.role === 'employee').length === 0 ? (
                              <SelectItem value="no-employees" disabled>No employees available</SelectItem>
                            ) : (
                              employees.filter((emp: User) => emp.role === 'employee').map((employee: User) => (
                                <SelectItem key={employee.id} value={employee.id.toString()}>
                                  {employee.firstName} {employee.lastName} ({employee.email})
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Label htmlFor="location-select">Select Location</Label>
                        <Select 
                          value={selectedLocationId?.toString() || ""} 
                          onValueChange={(value) => setSelectedLocationId(parseInt(value))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Choose a location..." />
                          </SelectTrigger>
                          <SelectContent>
                            {locations.length === 0 ? (
                              <SelectItem value="no-locations" disabled>No locations available</SelectItem>
                            ) : (
                              locations.map((location: Location) => (
                                <SelectItem key={location.id} value={location.id.toString()}>
                                  {location.name} ({location.postcode})
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="flex items-end">
                        <Button
                          onClick={() => {
                            if (selectedEmployeeId && selectedLocationId) {
                              assignLocationMutation.mutate({
                                userId: selectedEmployeeId,
                                locationId: selectedLocationId
                              });
                            }
                          }}
                          disabled={!selectedEmployeeId || !selectedLocationId || assignLocationMutation.isPending}
                          className="w-full"
                        >
                          <UserCheck className="w-4 h-4 mr-2" />
                          {assignLocationMutation.isPending ? "Assigning..." : "Assign Location"}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Current Assignments */}
                  <div>
                    <h3 className="font-medium mb-4 text-lg">Current Location Assignments</h3>
                    {assignmentsLoading ? (
                      <div className="text-center py-8 text-gray-500">Loading assignments...</div>
                    ) : employeeLocations.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        No location assignments yet. Use the form above to assign employees to locations.
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Employee</TableHead>
                            <TableHead>Location</TableHead>
                            <TableHead>Postcode</TableHead>
                            <TableHead>Assigned Date</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {employeeLocations.map((assignment: EmployeeLocation & { user: User; location: Location }) => (
                            <TableRow key={`${assignment.userId}-${assignment.locationId}`}>
                              <TableCell>
                                <div>
                                  <div className="font-medium">
                                    {assignment.user.firstName} {assignment.user.lastName}
                                  </div>
                                  <div className="text-sm text-gray-500">{assignment.user.email}</div>
                                </div>
                              </TableCell>
                              <TableCell className="font-medium">{assignment.location.name}</TableCell>
                              <TableCell>{assignment.location.postcode}</TableCell>
                              <TableCell>
                                {new Date(assignment.createdAt).toLocaleDateString()}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => removeLocationMutation.mutate({
                                    userId: assignment.userId,
                                    locationId: assignment.locationId
                                  })}
                                  disabled={removeLocationMutation.isPending}
                                >
                                  Remove
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Employees Tab */}
          <TabsContent value="employees">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      Employee Management
                    </CardTitle>
                    <CardDescription>
                      Manage employee accounts and face recognition
                    </CardDescription>
                  </div>
                  <Dialog open={isAddEmployeeOpen} onOpenChange={setIsAddEmployeeOpen}>
                    <DialogTrigger asChild>
                      <Button className="flex items-center gap-2">
                        <UserPlus className="w-4 h-4" />
                        Add Employee
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Add New Employee</DialogTitle>
                        <DialogDescription>
                          Create a new employee account directly. Default password will be "password123".
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="firstName">First Name</Label>
                            <Input 
                              id="firstName" 
                              placeholder="Enter first name"
                              value={newEmployee.firstName}
                              onChange={(e) => setNewEmployee(prev => ({ ...prev, firstName: e.target.value }))}
                            />
                          </div>
                          <div>
                            <Label htmlFor="lastName">Last Name</Label>
                            <Input 
                              id="lastName" 
                              placeholder="Enter last name"
                              value={newEmployee.lastName}
                              onChange={(e) => setNewEmployee(prev => ({ ...prev, lastName: e.target.value }))}
                            />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="email">Email Address</Label>
                          <Input 
                            id="email" 
                            type="email" 
                            placeholder="employee@company.com"
                            value={newEmployee.email}
                            onChange={(e) => setNewEmployee(prev => ({ ...prev, email: e.target.value }))}
                          />
                        </div>
                        <div>
                          <Label htmlFor="role">Role</Label>
                          <Select 
                            value={newEmployee.role} 
                            onValueChange={(value) => setNewEmployee(prev => ({ ...prev, role: value }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="employee">Employee</SelectItem>
                              <SelectItem value="manager">Manager</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" onClick={() => setIsAddEmployeeOpen(false)}>
                            Cancel
                          </Button>
                          <Button 
                            onClick={() => createEmployeeMutation.mutate(newEmployee)}
                            disabled={createEmployeeMutation.isPending || !newEmployee.firstName || !newEmployee.lastName || !newEmployee.email}
                          >
                            {createEmployeeMutation.isPending ? "Creating..." : "Create Employee"}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {employeesLoading ? (
                  <div className="text-center py-8">Loading employees...</div>
                ) : employeesError ? (
                  <div className="text-center py-8 text-red-500">
                    Error loading employees: {employeesError.message}
                  </div>
                ) : employees.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No employees found. Contact admin to add employees.
                  </div>
                ) : (
                  <div>
                    <div className="mb-4 text-sm text-gray-600">
                      Total employees: {employees.length} | 
                      Active: {employees.filter((emp: User) => emp.isActive).length} | 
                      With face registration: {employees.filter((emp: User) => emp.faceImageUrl).length}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {employees.map((employee: User) => {
                        // Get assigned locations for this employee
                        const assignedLocationIds = employeeLocations
                          .filter((assignment: any) => assignment.userId === employee.id)
                          .map((assignment: any) => assignment.locationId);
                        
                        const assignedLocations = locations.filter((location: Location) => 
                          assignedLocationIds.includes(location.id)
                        );

                        return (
                          <div key={employee.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <h3 className="font-medium text-lg">{employee.firstName} {employee.lastName}</h3>
                                <p className="text-sm text-gray-600">{employee.email}</p>
                                <p className="text-xs text-gray-500">ID: {employee.id}</p>
                              </div>
                              <Badge variant={employee.role === 'manager' ? 'secondary' : 'default'}>
                                {employee.role}
                              </Badge>
                            </div>
                            
                            <div className="space-y-2 mb-3">
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${
                                  employee.faceImageUrl ? 'bg-green-500' : 'bg-yellow-500'
                                }`} />
                                <span className="text-xs">
                                  {employee.faceImageUrl ? 'Face registered' : 'No face image'}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${
                                  employee.isActive ? 'bg-green-500' : 'bg-red-500'
                                }`} />
                                <span className="text-xs">
                                  {employee.isActive ? 'Active' : 'Inactive'}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${
                                  assignedLocations.length > 0 ? 'bg-blue-500' : 'bg-gray-400'
                                }`} />
                                <span className="text-xs">
                                  {assignedLocations.length} location(s) assigned
                                </span>
                              </div>
                            </div>

                            {/* Show assigned locations */}
                            {assignedLocations.length > 0 && (
                              <div className="mt-3 pt-3 border-t">
                                <p className="text-xs font-medium text-gray-700 mb-1">Assigned Locations:</p>
                                <div className="space-y-1">
                                  {assignedLocations.map((location: Location) => (
                                    <div key={location.id} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">
                                      {location.name} ({location.postcode})
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Face Image and Update Button */}
                            <div className="mt-3 pt-3 border-t">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  {employee.faceImageUrl ? (
                                    <img 
                                      src={employee.faceImageUrl} 
                                      alt="Employee face"
                                      className="w-12 h-12 rounded-full object-cover border"
                                    />
                                  ) : (
                                    <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                                      <Users className="w-6 h-6 text-gray-400" />
                                    </div>
                                  )}
                                  <div>
                                    <p className="text-xs font-medium">Face Image</p>
                                    <p className="text-xs text-gray-500">
                                      {employee.faceImageUrl ? 'Registered' : 'Not set'}
                                    </p>
                                  </div>
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleUpdateFace(employee.id)}
                                  disabled={updateFaceMutation.isPending}
                                >
                                  <Upload className="w-3 h-3 mr-1" />
                                  {employee.faceImageUrl ? 'Update' : 'Add'}
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Locations Tab */}
          <TabsContent value="locations">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Office Locations
                </CardTitle>
                <CardDescription>
                  Available office locations (managed by admin)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {locationsLoading ? (
                  <div className="text-center py-8">Loading locations...</div>
                ) : locations.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No locations available. Contact admin to add office locations.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Postcode</TableHead>
                        <TableHead>Address</TableHead>
                        <TableHead>Radius</TableHead>
                        <TableHead>Assigned Employees</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {locations.map((location: Location) => {
                        const assignedEmployeeCount = employeeLocations.filter(
                          (assignment: any) => assignment.locationId === location.id
                        ).length;
                        
                        return (
                          <TableRow key={location.id}>
                            <TableCell className="font-medium">{location.name}</TableCell>
                            <TableCell>{location.postcode}</TableCell>
                            <TableCell className="max-w-xs truncate">{location.address}</TableCell>
                            <TableCell>{location.radiusMeters}m</TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {assignedEmployeeCount} employee(s)
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={location.isActive ? "default" : "secondary"}>
                                {location.isActive ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Attendance Tab */}
          <TabsContent value="attendance">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Attendance Records
                </CardTitle>
                <CardDescription>
                  Recent employee attendance data
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Clock In</TableHead>
                      <TableHead>Clock Out</TableHead>
                      <TableHead>Method</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendanceRecords.slice(0, 10).map((record: AttendanceRecord) => {
                      const employee = employees.find((emp: User) => emp.id === record.userId);
                      return (
                        <TableRow key={record.id}>
                          <TableCell>
                            {employee ? `${employee.firstName} ${employee.lastName}` : 'Unknown'}
                          </TableCell>
                          <TableCell>{record.date}</TableCell>
                          <TableCell>
                            {format(new Date(record.clockInTime), 'HH:mm')}
                          </TableCell>
                          <TableCell>
                            {record.clockOutTime 
                              ? format(new Date(record.clockOutTime), 'HH:mm')
                              : 'Not clocked out'
                            }
                          </TableCell>
                          <TableCell>
                            <Badge variant={record.checkInMethod === 'face' ? 'default' : 'secondary'}>
                              {record.checkInMethod}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Invitations Tab */}
          <TabsContent value="invitations">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="w-5 h-5" />
                  Employee Invitations
                </CardTitle>
                <CardDescription>
                  Pending employee invitations
                </CardDescription>
              </CardHeader>
              <CardContent>
                {invitations.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No pending invitations
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Expires</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invitations.map((invitation: EmployeeInvitation) => (
                        <TableRow key={invitation.id}>
                          <TableCell>{invitation.email}</TableCell>
                          <TableCell>{invitation.role}</TableCell>
                          <TableCell>
                            {format(new Date(invitation.expiresAt), 'MMM dd, yyyy')}
                          </TableCell>
                          <TableCell>
                            <Badge variant={invitation.used ? 'secondary' : 'default'}>
                              {invitation.used ? 'Used' : 'Pending'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Employee Analytics
                </CardTitle>
                <CardDescription>
                  Detailed work hour analytics and employee performance tracking
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ManagerAnalyticsDashboard />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <ChangePasswordDialog 
        open={showPasswordDialog} 
        onOpenChange={setShowPasswordDialog} 
      />
    </div>
  );
}