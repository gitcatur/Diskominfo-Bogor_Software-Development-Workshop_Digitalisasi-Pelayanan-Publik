"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  Select,
  message,
  Card,
  Row,
  Col,
  Input,
  DatePicker,
  Button,
  Space,
  Dropdown,
  Checkbox,
  Tag,
  Tooltip as AntTooltip
} from "antd";
import {
  SearchOutlined,
  FilterOutlined,
  ClearOutlined,
  SettingOutlined,
  DownloadOutlined,
  ReloadOutlined
} from "@ant-design/icons";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";

const { Option } = Select;
const { RangePicker } = DatePicker;

export default function AdminDashboard() {
  const router = useRouter();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState([]);
  const [updatingStatus, setUpdatingStatus] = useState({}); // Track which submission is being updated
  const [refreshing, setRefreshing] = useState(false); // Track refresh loading state

  // Filter and search states
  const [globalSearchText, setGlobalSearchText] = useState("");
  const [filters, setFilters] = useState({
    status: [], // Multi-value filter for status
    tracking_code: "",
    nama: "",
    jenis_layanan: [], // Multi-value filter for jenis layanan
    created_at: null,
    updated_at: null,
  });
  const [sortedInfo, setSortedInfo] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState({
    tracking_code: true,
    nama: true,
    jenis_layanan: true,
    status: true,
    created_at: true,
    updated_at: true,
  });

  const COLORS = ["#ffc107", "#1890ff", "#52c41a", "#ff4d4f"];

  useEffect(() => {
    // Check if admin is logged in
    const checkAuth = () => {
      const isLoggedIn = localStorage.getItem("adminLoggedIn");
      console.log("Auth check - isLoggedIn:", isLoggedIn); // Debug log
      if (!isLoggedIn) {
        console.log("Not logged in, redirecting to login"); // Debug log
        router.push("/admin/login");
        return;
      }
      console.log("Logged in, fetching submissions"); // Debug log
      fetchSubmissions();
    };

    // Add a small delay to ensure localStorage is available
    setTimeout(checkAuth, 100);
  }, [router]);

  const fetchSubmissions = async (showLoading = false) => {
    if (showLoading) {
      setRefreshing(true);
    }

    try {
      // Ultra-aggressive cache bypass
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(7);
      const forceRefresh = Date.now();
      const cacheBuster = Math.random().toString(36).substring(7);

      const response = await fetch(
        `/api/admin/submissions?t=${timestamp}&r=${random}&force=${forceRefresh}&cb=${cacheBuster}&_=${Date.now()}`,
        {
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
            Pragma: "no-cache",
            "X-Requested-With": "XMLHttpRequest",
            "X-Force-Refresh": "true",
            "X-Cache-Buster": `${timestamp}-${random}`,
            "X-Request-Time": `${Date.now()}`,
          },
          // Force fresh request
          cache: "no-store",
        }
      );
      const data = await response.json();

      if (response.ok) {
        setSubmissions(data);
        updateChartData(data);
        if (showLoading) {
          message.success("Data berhasil diperbarui");
        }
      } else {
        message.error("Gagal memuat data pengajuan");
      }
    } catch (error) {
      message.error("Terjadi kesalahan jaringan");
    } finally {
      setLoading(false);
      if (showLoading) {
        setRefreshing(false);
      }
    }
  };

  // Simple refresh function
  const handleRefresh = () => {
    fetchSubmissions(true);
  };

  const updateChartData = (data) => {
    const statusCount = data.reduce((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {});

    const chartData = Object.entries(statusCount).map(([status, count]) => ({
      name: getStatusText(status),
      value: count,
      status,
    }));

    setChartData(chartData);
  };

  const getStatusText = (status) => {
    switch (status) {
      case "PENGAJUAN_BARU":
        return "Pengajuan Baru";
      case "DIPROSES":
        return "Sedang Diproses";
      case "SELESAI":
        return "Selesai";
      case "DITOLAK":
        return "Ditolak";
      default:
        return status;
    }
  };

  const handleStatusChange = async (submissionId, newStatus) => {
    // Set loading state for this specific submission
    setUpdatingStatus((prev) => ({ ...prev, [submissionId]: true }));

    try {
      const response = await fetch(
        `/api/admin/submissions/${submissionId}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
            "X-Requested-With": "XMLHttpRequest",
          },
          body: JSON.stringify({ status: newStatus }),
        }
      );

      if (response.ok) {
        message.success("Status berhasil diupdate");
        // Extended loading state untuk memastikan data ter-update
        // Keep loading for 2.5 seconds to ensure data is fresh
        setTimeout(() => {
          // Force refresh dengan cache bypass yang lebih agresif
          const forceTimestamp = Date.now();
          const forceRandom = Math.random().toString(36).substring(7);
          const forceCacheBuster = Math.random().toString(36).substring(7);

          // Multiple refresh attempts dengan delay yang lebih lama
          fetchSubmissions(true);

          // Additional force refresh after 1.5 seconds
          setTimeout(() => {
            fetch(
              `/api/admin/submissions?force=${forceTimestamp}&r=${forceRandom}&cb=${forceCacheBuster}&_=${Date.now()}`,
              {
                headers: {
                  "Cache-Control":
                    "no-cache, no-store, must-revalidate, max-age=0",
                  "X-Force-Refresh": "true",
                  "X-Cache-Buster": `${forceTimestamp}-${forceRandom}`,
                },
                cache: "no-store",
              }
            ).then(() => {
              // Final refresh
              fetchSubmissions(true);
            });
          }, 1500); // Increased delay to 1.5 seconds
        }, 1000); // Increased initial delay to 1 second
      } else {
        const error = await response.json();
        message.error(error.message || "Gagal mengupdate status");
      }
    } catch (error) {
      message.error("Terjadi kesalahan jaringan");
    } finally {
      // Clear loading state after extended delay to ensure data is fresh
      setTimeout(() => {
        setUpdatingStatus((prev) => ({ ...prev, [submissionId]: false }));
      }, 2500); // Total loading time: 2.5 seconds
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("adminLoggedIn");
    localStorage.removeItem("adminInfo");
    router.push("/admin/login");
  };

  // Get unique values for dropdown filters
  const uniqueJenisLayanan = useMemo(() => {
    const unique = [...new Set(submissions.map(item => item.jenis_layanan))];
    return unique.filter(Boolean).sort();
  }, [submissions]);

  // Filter and search logic
  const filteredAndSearchedSubmissions = useMemo(() => {
    let filtered = submissions;

    // Apply global search
    if (globalSearchText) {
      const searchLower = globalSearchText.toLowerCase();
      filtered = filtered.filter(item =>
        item.tracking_code?.toLowerCase().includes(searchLower) ||
        item.nama?.toLowerCase().includes(searchLower) ||
        item.jenis_layanan?.toLowerCase().includes(searchLower)
      );
    }

    // Apply column filters
    // Multi-value status filter
    if (filters.status.length > 0) {
      filtered = filtered.filter(item => filters.status.includes(item.status));
    }

    if (filters.tracking_code) {
      const trackingSearchLower = filters.tracking_code.toLowerCase();
      filtered = filtered.filter(item =>
        item.tracking_code?.toLowerCase().includes(trackingSearchLower)
      );
    }

    if (filters.nama) {
      const namaSearchLower = filters.nama.toLowerCase();
      filtered = filtered.filter(item =>
        item.nama?.toLowerCase().includes(namaSearchLower)
      );
    }

    // Multi-value jenis layanan filter
    if (filters.jenis_layanan.length > 0) {
      filtered = filtered.filter(item => filters.jenis_layanan.includes(item.jenis_layanan));
    }

    if (filters.created_at && filters.created_at.length === 2) {
      const [startDate, endDate] = filters.created_at;
      filtered = filtered.filter(item => {
        const itemDate = new Date(item.created_at);
        return itemDate >= startDate.startOf('day').toDate() &&
               itemDate <= endDate.endOf('day').toDate();
      });
    }

    if (filters.updated_at && filters.updated_at.length === 2) {
      const [startDate, endDate] = filters.updated_at;
      filtered = filtered.filter(item => {
        const itemDate = new Date(item.updated_at);
        return itemDate >= startDate.startOf('day').toDate() &&
               itemDate <= endDate.endOf('day').toDate();
      });
    }

    return filtered;
  }, [submissions, globalSearchText, filters]);

  // Handle filter changes
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Clear all filters
  const clearAllFilters = () => {
    setGlobalSearchText("");
    setFilters({
      status: [],
      tracking_code: "",
      nama: "",
      jenis_layanan: [],
      created_at: null,
      updated_at: null,
    });
    setSortedInfo({});
  };

  // Get active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (globalSearchText) count++;
    if (filters.status.length > 0) count++;
    if (filters.tracking_code) count++;
    if (filters.nama) count++;
    if (filters.jenis_layanan.length > 0) count++;
    if (filters.created_at) count++;
    if (filters.updated_at) count++;
    return count;
  }, [globalSearchText, filters]);

  // Handle table changes (sorting, filtering)
  const handleTableChange = (pagination, filters, sorter) => {
    setSortedInfo(sorter);
  };

  // Column visibility controls
  const handleColumnVisibilityChange = (column, visible) => {
    setVisibleColumns(prev => ({
      ...prev,
      [column]: visible
    }));
  };

  // Filter preset functions
  const applyFilterPreset = (preset) => {
    switch (preset) {
      case 'active':
        handleFilterChange('status', ['PENGAJUAN_BARU', 'DIPROSES']);
        break;
      case 'completed':
        handleFilterChange('status', ['SELESAI', 'DITOLAK']);
        break;
      case 'new':
        handleFilterChange('status', ['PENGAJUAN_BARU']);
        break;
      case 'processing':
        handleFilterChange('status', ['DIPROSES']);
        break;
      case 'finished':
        handleFilterChange('status', ['SELESAI']);
        break;
      case 'rejected':
        handleFilterChange('status', ['DITOLAK']);
        break;
      default:
        break;
    }
  };

  // Quick select functions for multi-select filters
  const selectAllStatus = () => {
    handleFilterChange('status', ['PENGAJUAN_BARU', 'DIPROSES', 'SELESAI', 'DITOLAK']);
  };

  const selectAllJenisLayanan = () => {
    handleFilterChange('jenis_layanan', uniqueJenisLayanan);
  };

  const clearStatusFilter = () => {
    handleFilterChange('status', []);
  };

  const clearJenisLayananFilter = () => {
    handleFilterChange('jenis_layanan', []);
  };

  const columns = [
    {
      title: "Kode Tracking",
      dataIndex: "tracking_code",
      key: "tracking_code",
      sorter: (a, b) => (a.tracking_code || "").localeCompare(b.tracking_code || ""),
      sortOrder: sortedInfo.columnKey === 'tracking_code' ? sortedInfo.order : null,
      render: (text) => {
        const highlighted = globalSearchText && text?.toLowerCase().includes(globalSearchText.toLowerCase());
        return (
          <div className="max-w-[120px] sm:max-w-[200px] lg:max-w-[300px]">
            <span
              className={`font-mono text-xs sm:text-sm break-all leading-tight ${highlighted ? 'bg-yellow-200' : ''}`}
              title={text}
            >
              {text}
            </span>
          </div>
        );
      },
      width: 200,
      fixed: "left",
    },
    {
      title: "Nama",
      dataIndex: "nama",
      key: "nama",
      sorter: (a, b) => (a.nama || "").localeCompare(b.nama || ""),
      sortOrder: sortedInfo.columnKey === 'nama' ? sortedInfo.order : null,
      width: 120,
      render: (text) => {
        const highlighted = globalSearchText && text?.toLowerCase().includes(globalSearchText.toLowerCase());
        return (
          <div className="max-w-[80px] sm:max-w-[120px]">
            <span
              className={`text-xs sm:text-sm break-words leading-tight ${highlighted ? 'bg-yellow-200' : ''}`}
              title={text}
            >
              {text}
            </span>
          </div>
        );
      },
    },
    {
      title: "Jenis Layanan",
      dataIndex: "jenis_layanan",
      key: "jenis_layanan",
      sorter: (a, b) => (a.jenis_layanan || "").localeCompare(b.jenis_layanan || ""),
      sortOrder: sortedInfo.columnKey === 'jenis_layanan' ? sortedInfo.order : null,
      width: 120,
      render: (text) => {
        const highlighted = globalSearchText && text?.toLowerCase().includes(globalSearchText.toLowerCase());
        return (
          <div className="max-w-[80px] sm:max-w-[120px]">
            <span
              className={`text-xs sm:text-sm break-words leading-tight ${highlighted ? 'bg-yellow-200' : ''}`}
              title={text}
            >
              {text}
            </span>
          </div>
        );
      },
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      sorter: (a, b) => {
        const statusOrder = { "PENGAJUAN_BARU": 1, "DIPROSES": 2, "SELESAI": 3, "DITOLAK": 4 };
        return (statusOrder[a.status] || 5) - (statusOrder[b.status] || 5);
      },
      sortOrder: sortedInfo.columnKey === 'status' ? sortedInfo.order : null,
      width: 180,
      render: (status, record) => (
        <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-1 sm:space-y-0 sm:space-x-2">
          <Select
            value={status}
            style={{ width: "100%", minWidth: "100px", maxWidth: "150px" }}
            onChange={(value) => handleStatusChange(record.id, value)}
            disabled={updatingStatus[record.id]}
            loading={updatingStatus[record.id]}
            size="small"
          >
            <Option value="PENGAJUAN_BARU">Pengajuan Baru</Option>
            <Option value="DIPROSES">Sedang Diproses</Option>
            <Option value="SELESAI">Selesai</Option>
            <Option value="DITOLAK">Ditolak</Option>
          </Select>
          {updatingStatus[record.id] && (
            <div className="flex items-center text-blue-600 text-xs sm:text-sm">
              <svg
                className="animate-spin h-3 w-3 sm:h-4 sm:w-4 mr-1"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              <span className="hidden sm:inline">Updating...</span>
              <span className="sm:hidden">...</span>
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Dibuat",
      dataIndex: "created_at",
      key: "created_at",
      sorter: (a, b) => new Date(a.created_at) - new Date(b.created_at),
      sortOrder: sortedInfo.columnKey === 'created_at' ? sortedInfo.order : null,
      width: 150,
      responsive: ["lg"],
      render: (date) => {
        if (!date) return "-";
        try {
          const formattedDate = new Date(date).toLocaleString("id-ID", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          });
          return (
            <div className="max-w-[100px] sm:max-w-[150px]">
              <span
                className="text-xs sm:text-sm break-words leading-tight"
                title={formattedDate}
              >
                {formattedDate}
              </span>
            </div>
          );
        } catch (error) {
          return "-";
        }
      },
    },
    {
      title: "Diupdate",
      dataIndex: "updated_at",
      key: "updated_at",
      sorter: (a, b) => new Date(a.updated_at) - new Date(b.updated_at),
      sortOrder: sortedInfo.columnKey === 'updated_at' ? sortedInfo.order : null,
      width: 150,
      responsive: ["lg"],
      render: (date) => {
        if (!date) return "-";
        try {
          const formattedDate = new Date(date).toLocaleString("id-ID", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          });
          return (
            <div className="max-w-[100px] sm:max-w-[150px]">
              <span
                className="text-xs sm:text-sm break-words leading-tight"
                title={formattedDate}
              >
                {formattedDate}
              </span>
            </div>
          );
        } catch (error) {
          return "-";
        }
      },
    },
  ].filter(column => visibleColumns[column.key]);

  // Column visibility menu
  const columnMenu = {
    items: [
      {
        key: 'tracking_code',
        label: (
          <Checkbox
            checked={visibleColumns.tracking_code}
            onChange={(e) => handleColumnVisibilityChange('tracking_code', e.target.checked)}
          >
            Kode Tracking
          </Checkbox>
        ),
      },
      {
        key: 'nama',
        label: (
          <Checkbox
            checked={visibleColumns.nama}
            onChange={(e) => handleColumnVisibilityChange('nama', e.target.checked)}
          >
            Nama
          </Checkbox>
        ),
      },
      {
        key: 'jenis_layanan',
        label: (
          <Checkbox
            checked={visibleColumns.jenis_layanan}
            onChange={(e) => handleColumnVisibilityChange('jenis_layanan', e.target.checked)}
          >
            Jenis Layanan
          </Checkbox>
        ),
      },
      {
        key: 'status',
        label: (
          <Checkbox
            checked={visibleColumns.status}
            onChange={(e) => handleColumnVisibilityChange('status', e.target.checked)}
          >
            Status
          </Checkbox>
        ),
      },
      {
        key: 'created_at',
        label: (
          <Checkbox
            checked={visibleColumns.created_at}
            onChange={(e) => handleColumnVisibilityChange('created_at', e.target.checked)}
          >
            Dibuat
          </Checkbox>
        ),
      },
      {
        key: 'updated_at',
        label: (
          <Checkbox
            checked={visibleColumns.updated_at}
            onChange={(e) => handleColumnVisibilityChange('updated_at', e.target.checked)}
          >
            Diupdate
          </Checkbox>
        ),
      },
    ],
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                Admin Dashboard
              </h1>
              <p className="text-sm sm:text-base text-gray-600 mt-1">
                {loading
                  ? "Memuat data pengajuan..."
                  : "Kelola pengajuan layanan masyarakat"}
              </p>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
              <Button
                icon={<ReloadOutlined />}
                onClick={handleRefresh}
                loading={refreshing || loading}
                type="primary"
                size="middle"
              >
                {refreshing ? "Refreshing..." : loading ? "Loading..." : "Refresh"}
              </Button>

              <button
                onClick={handleLogout}
                className="bg-red-600 hover:bg-red-700 text-white px-3 sm:px-4 py-2 rounded-lg text-sm sm:text-base"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-4 sm:py-8">
        {/* Debug Info - Hidden for production */}
        {/* <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
           <div className="flex items-center">
             <svg
               className="w-5 h-5 text-yellow-600 mr-2"
               fill="none"
               stroke="currentColor"
               viewBox="0 0 24 24"
             >
               <path
                 strokeLinecap="round"
                 strokeLinejoin="round"
                 strokeWidth={2}
                 d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
               />
             </svg>
             <div className="text-sm text-yellow-800">
               <strong>Cache Bypass Active:</strong> Data akan auto-refresh
               setelah status update. Loading state extended untuk memastikan
               data fresh.
             </div>
           </div>
         </div> */}

        {/* Stats Cards */}
        <Row gutter={[8, 8]} className="mb-6 sm:mb-8">
          <Col xs={12} sm={6}>
            <Card>
              <div className="text-center">
                {loading ? (
                  <div className="flex items-center justify-center">
                    <svg
                      className="animate-spin h-5 w-5 sm:h-6 sm:w-6 text-blue-600"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                  </div>
                ) : (
                  <div className="text-lg sm:text-2xl font-bold text-blue-600">
                    {submissions.length}
                  </div>
                )}
                <div className="text-sm sm:text-base text-gray-600">
                  Total Pengajuan
                </div>
              </div>
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card>
              <div className="text-center">
                {loading ? (
                  <div className="flex items-center justify-center">
                    <svg
                      className="animate-spin h-5 w-5 sm:h-6 sm:w-6 text-yellow-600"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                  </div>
                ) : (
                  <div className="text-lg sm:text-2xl font-bold text-yellow-600">
                    {
                      submissions.filter((s) => s.status === "PENGAJUAN_BARU")
                        .length
                    }
                  </div>
                )}
                <div className="text-sm sm:text-base text-gray-600">
                  Pengajuan Baru
                </div>
              </div>
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card>
              <div className="text-center">
                {loading ? (
                  <div className="flex items-center justify-center">
                    <svg
                      className="animate-spin h-5 w-5 sm:h-6 sm:w-6 text-blue-600"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                  </div>
                ) : (
                  <div className="text-lg sm:text-2xl font-bold text-blue-600">
                    {submissions.filter((s) => s.status === "DIPROSES").length}
                  </div>
                )}
                <div className="text-sm sm:text-base text-gray-600">
                  Sedang Diproses
                </div>
              </div>
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card>
              <div className="text-center">
                {loading ? (
                  <div className="flex items-center justify-center">
                    <svg
                      className="animate-spin h-5 w-5 sm:h-6 sm:w-6 text-green-600"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                  </div>
                ) : (
                  <div className="text-lg sm:text-2xl font-bold text-green-600">
                    {submissions.filter((s) => s.status === "SELESAI").length}
                  </div>
                )}
                <div className="text-sm sm:text-base text-gray-600">
                  Selesai
                </div>
              </div>
            </Card>
          </Col>
        </Row>

        {/* Chart */}
        <Card title="Distribusi Status Pengajuan" className="mb-6 sm:mb-8">
          {loading ? (
            <div className="flex items-center justify-center h-[300px]">
              <div className="text-center">
                <svg
                  className="animate-spin h-8 w-8 sm:h-12 sm:w-12 text-blue-600 mx-auto mb-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                <p className="text-gray-600">Memuat data chart...</p>
              </div>
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex items-center justify-center h-[300px]">
              <div className="text-center text-gray-500">
                <svg
                  className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-4 text-gray-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
                <p className="text-base sm:text-lg font-medium">
                  Belum ada data
                </p>
                <p className="text-xs sm:text-sm">
                  Data chart akan muncul setelah ada pengajuan
                </p>
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Table */}
        <Card
          title={
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
              <span>Daftar Pengajuan</span>
              <div className="flex items-center space-x-2">
                {activeFilterCount > 0 && (
                  <Tag color="blue">{activeFilterCount} Filter Aktif</Tag>
                )}
                <Button
                  icon={<FilterOutlined />}
                  onClick={() => setShowFilters(!showFilters)}
                  type={showFilters ? "primary" : "default"}
                  size="small"
                >
                  Filter
                </Button>
                <Dropdown menu={columnMenu} trigger={['click']}>
                  <Button icon={<SettingOutlined />} size="small">
                    Kolom
                  </Button>
                </Dropdown>
              </div>
            </div>
          }
        >
          {/* Global Search */}
          <div className="mb-4">
            <Input.Search
              placeholder="Cari berdasarkan kode tracking, nama, atau jenis layanan..."
              value={globalSearchText}
              onChange={(e) => setGlobalSearchText(e.target.value)}
              onSearch={setGlobalSearchText}
              style={{ maxWidth: 400 }}
              allowClear
              disabled={loading}
            />
          </div>

          {/* Advanced Filters Panel */}
          {showFilters && (
            <Card className="mb-4" size="small">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Status Filter */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-sm font-medium text-gray-700">
                      Status {filters.status.length > 0 && (
                        <Tag color="blue" size="small">{filters.status.length}</Tag>
                      )}
                    </label>
                    <div className="flex space-x-1">
                      <Button
                        type="link"
                        size="small"
                        onClick={selectAllStatus}
                        disabled={loading}
                        className="p-0 h-auto text-xs"
                      >
                        Semua
                      </Button>
                      <Button
                        type="link"
                        size="small"
                        onClick={clearStatusFilter}
                        disabled={loading || filters.status.length === 0}
                        className="p-0 h-auto text-xs"
                      >
                        Clear
                      </Button>
                    </div>
                  </div>
                  <Select
                    mode="multiple"
                    value={filters.status}
                    onChange={(value) => handleFilterChange('status', value)}
                    style={{ width: "100%" }}
                    placeholder="Pilih status..."
                    disabled={loading}
                    maxTagCount={2}
                    maxTagPlaceholder={(omittedValues) => `+${omittedValues.length} more`}
                    allowClear
                  >
                    <Option value="PENGAJUAN_BARU">Pengajuan Baru</Option>
                    <Option value="DIPROSES">Sedang Diproses</Option>
                    <Option value="SELESAI">Selesai</Option>
                    <Option value="DITOLAK">Ditolak</Option>
                  </Select>

                  {/* Quick Filter Presets */}
                  <div className="flex flex-wrap gap-1 mt-2">
                    <Button
                      size="small"
                      type="text"
                      onClick={() => applyFilterPreset('active')}
                      disabled={loading}
                      className="text-xs h-6 px-2"
                    >
                      Aktif
                    </Button>
                    <Button
                      size="small"
                      type="text"
                      onClick={() => applyFilterPreset('completed')}
                      disabled={loading}
                      className="text-xs h-6 px-2"
                    >
                      Selesai
                    </Button>
                    <Button
                      size="small"
                      type="text"
                      onClick={() => applyFilterPreset('new')}
                      disabled={loading}
                      className="text-xs h-6 px-2"
                    >
                      Baru
                    </Button>
                  </div>
                </div>

                {/* Tracking Code Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Kode Tracking
                  </label>
                  <Input
                    value={filters.tracking_code}
                    onChange={(e) => handleFilterChange('tracking_code', e.target.value)}
                    placeholder="Cari kode tracking..."
                    allowClear
                    disabled={loading}
                  />
                </div>

                {/* Nama Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nama
                  </label>
                  <Input
                    value={filters.nama}
                    onChange={(e) => handleFilterChange('nama', e.target.value)}
                    placeholder="Cari nama..."
                    allowClear
                    disabled={loading}
                  />
                </div>

                {/* Jenis Layanan Filter */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-sm font-medium text-gray-700">
                      Jenis Layanan {filters.jenis_layanan.length > 0 && (
                        <Tag color="green" size="small">{filters.jenis_layanan.length}</Tag>
                      )}
                    </label>
                    <div className="flex space-x-1">
                      <Button
                        type="link"
                        size="small"
                        onClick={selectAllJenisLayanan}
                        disabled={loading || uniqueJenisLayanan.length === 0}
                        className="p-0 h-auto text-xs"
                      >
                        Semua
                      </Button>
                      <Button
                        type="link"
                        size="small"
                        onClick={clearJenisLayananFilter}
                        disabled={loading || filters.jenis_layanan.length === 0}
                        className="p-0 h-auto text-xs"
                      >
                        Clear
                      </Button>
                    </div>
                  </div>
                  <Select
                    mode="multiple"
                    value={filters.jenis_layanan}
                    onChange={(value) => handleFilterChange('jenis_layanan', value)}
                    style={{ width: "100%" }}
                    placeholder="Pilih jenis layanan..."
                    disabled={loading}
                    maxTagCount={2}
                    maxTagPlaceholder={(omittedValues) => `+${omittedValues.length} more`}
                    allowClear
                    showSearch
                    filterOption={(input, option) =>
                      option?.children?.toLowerCase().includes(input.toLowerCase())
                    }
                  >
                    {uniqueJenisLayanan.map(layanan => (
                      <Option key={layanan} value={layanan}>{layanan}</Option>
                    ))}
                  </Select>
                </div>

                {/* Created Date Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tanggal Dibuat
                  </label>
                  <RangePicker
                    value={filters.created_at}
                    onChange={(dates) => handleFilterChange('created_at', dates)}
                    style={{ width: "100%" }}
                    placeholder={['Dari tanggal', 'Sampai tanggal']}
                    disabled={loading}
                  />
                </div>

                {/* Updated Date Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tanggal Diupdate
                  </label>
                  <RangePicker
                    value={filters.updated_at}
                    onChange={(dates) => handleFilterChange('updated_at', dates)}
                    style={{ width: "100%" }}
                    placeholder={['Dari tanggal', 'Sampai tanggal']}
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Active Filters Summary */}
              {activeFilterCount > 0 && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <div className="text-sm font-medium text-blue-800 mb-2">Filter Aktif:</div>
                  <div className="flex flex-wrap gap-2">
                    {globalSearchText && (
                      <Tag
                        color="orange"
                        closable
                        onClose={() => setGlobalSearchText("")}
                        className="text-xs"
                      >
                        Pencarian: "{globalSearchText}"
                      </Tag>
                    )}
                    {filters.status.length > 0 && (
                      <Tag
                        color="blue"
                        closable
                        onClose={() => handleFilterChange('status', [])}
                        className="text-xs"
                      >
                        Status: {filters.status.join(', ')}
                      </Tag>
                    )}
                    {filters.tracking_code && (
                      <Tag
                        color="purple"
                        closable
                        onClose={() => handleFilterChange('tracking_code', '')}
                        className="text-xs"
                      >
                        Tracking: "{filters.tracking_code}"
                      </Tag>
                    )}
                    {filters.nama && (
                      <Tag
                        color="cyan"
                        closable
                        onClose={() => handleFilterChange('nama', '')}
                        className="text-xs"
                      >
                        Nama: "{filters.nama}"
                      </Tag>
                    )}
                    {filters.jenis_layanan.length > 0 && (
                      <Tag
                        color="green"
                        closable
                        onClose={() => handleFilterChange('jenis_layanan', [])}
                        className="text-xs"
                      >
                        Layanan: {filters.jenis_layanan.length > 2
                          ? `${filters.jenis_layanan.slice(0, 2).join(', ')} +${filters.jenis_layanan.length - 2}`
                          : filters.jenis_layanan.join(', ')
                        }
                      </Tag>
                    )}
                    {filters.created_at && (
                      <Tag
                        color="magenta"
                        closable
                        onClose={() => handleFilterChange('created_at', null)}
                        className="text-xs"
                      >
                        Dibuat: {filters.created_at[0].format('DD/MM/YYYY')} - {filters.created_at[1].format('DD/MM/YYYY')}
                      </Tag>
                    )}
                    {filters.updated_at && (
                      <Tag
                        color="volcano"
                        closable
                        onClose={() => handleFilterChange('updated_at', null)}
                        className="text-xs"
                      >
                        Diupdate: {filters.updated_at[0].format('DD/MM/YYYY')} - {filters.updated_at[1].format('DD/MM/YYYY')}
                      </Tag>
                    )}
                  </div>
                </div>
              )}

              {/* Filter Actions */}
              <div className="flex justify-between items-center mt-4 pt-4 border-t">
                <div className="text-sm text-gray-600">
                  Menampilkan <span className="font-semibold text-blue-600">{filteredAndSearchedSubmissions.length}</span> dari <span className="font-semibold">{submissions.length}</span> data
                  {activeFilterCount > 0 && (
                    <span className="text-blue-600"> • {activeFilterCount} filter aktif</span>
                  )}
                </div>
                <Space>
                  <Button
                    icon={<ClearOutlined />}
                    onClick={clearAllFilters}
                    disabled={loading || activeFilterCount === 0}
                    size="small"
                    danger
                  >
                    Clear Semua Filter
                  </Button>
                </Space>
              </div>
            </Card>
          )}

          <div className="relative">
            <Table
              columns={columns}
              dataSource={filteredAndSearchedSubmissions}
              rowKey="id"
              loading={loading}
              onChange={handleTableChange}
              scroll={{ x: 800, y: 400 }}
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) =>
                  `${range[0]}-${range[1]} dari ${total} pengajuan`,
                size: "small",
                responsive: true,
                pageSizeOptions: ['10', '20', '50', '100'],
              }}
              size="small"
              className="responsive-table"
              bordered={false}
              tableLayout="fixed"
            />

            {/* Loading overlay when any status is being updated */}
            {Object.values(updatingStatus).some(Boolean) && (
              <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10">
                <div className="text-center">
                  <svg
                    className="animate-spin h-8 w-8 text-blue-600 mx-auto mb-2"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  <p className="text-blue-600 font-medium text-sm sm:text-base">
                    Memperbarui status...
                  </p>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Custom CSS for responsive table */}
      <style jsx global>{`
        .responsive-table .ant-table {
          overflow-x: auto;
        }

        .responsive-table .ant-table-thead > tr > th,
        .responsive-table .ant-table-tbody > tr > td {
          padding: 8px 12px;
          word-wrap: break-word;
          word-break: break-word;
        }

        .responsive-table .ant-table-thead > tr > th {
          background-color: #fafafa;
          font-weight: 600;
          color: #262626;
        }

        .responsive-table .ant-table-tbody > tr:hover > td {
          background-color: #f5f5f5;
        }

        /* Mobile optimizations */
        @media (max-width: 768px) {
          .responsive-table .ant-table {
            font-size: 11px;
          }

          .responsive-table .ant-table-thead > tr > th,
          .responsive-table .ant-table-tbody > tr > td {
            padding: 4px 6px;
            font-size: 10px;
          }

          .responsive-table .ant-table-pagination {
            font-size: 11px;
          }

          .responsive-table .ant-table-scroll {
            overflow-x: auto;
          }

          /* Ensure tracking code doesn't overflow */
          .responsive-table .ant-table-tbody > tr > td:first-child {
            max-width: 80px;
            min-width: 80px;
          }

          /* Compact status column */
          .responsive-table .ant-table-tbody > tr > td:nth-child(4) {
            max-width: 140px;
            min-width: 140px;
          }

          /* Compact nama and jenis layanan columns */
          .responsive-table .ant-table-tbody > tr > td:nth-child(2),
          .responsive-table .ant-table-tbody > tr > td:nth-child(3) {
            max-width: 80px;
            min-width: 80px;
          }
        }

        /* Small mobile devices */
        @media (max-width: 480px) {
          .responsive-table .ant-table-thead > tr > th,
          .responsive-table .ant-table-tbody > tr > td {
            padding: 2px 4px;
            font-size: 9px;
          }

          .responsive-table .ant-table-tbody > tr > td:first-child {
            max-width: 70px;
            min-width: 70px;
          }

          .responsive-table .ant-table-tbody > tr > td:nth-child(2),
          .responsive-table .ant-table-tbody > tr > td:nth-child(3) {
            max-width: 70px;
            min-width: 70px;
          }

          .responsive-table .ant-table-tbody > tr > td:nth-child(4) {
            max-width: 120px;
            min-width: 120px;
          }
        }
      `}</style>
    </div>
  );
}
