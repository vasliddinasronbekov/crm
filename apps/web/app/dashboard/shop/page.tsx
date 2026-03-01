'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import apiService from '@/lib/api'
import { toast } from 'react-hot-toast'
import { ShoppingCart, Package, Coins, Plus, Search, Edit, Trash2, X, DollarSign, Award, TrendingUp } from 'lucide-react'

interface Product {
  id: number
  name: string
  description: string
  price: number
  quantity: number
  image: string | null
  is_active: boolean
  created_at: string
}

interface Order {
  id: number
  student: number
  student_name?: string
  product: number
  product_name?: string
  quantity: number
  total_price: number
  status: 'pending' | 'completed' | 'cancelled'
  created_at: string
}

interface StudentCoins {
  student_id: number
  student_name: string
  balance: number
}

interface Student {
  id: number
  first_name: string
  last_name: string
  username: string
}

export default function ShopPage() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()

  // States
  const [products, setProducts] = useState<Product[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'products' | 'orders' | 'coins'>('products')

  // Modal states
  const [showProductModal, setShowProductModal] = useState(false)
  const [showAwardCoinsModal, setShowAwardCoinsModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)

  // Form states
  const [productForm, setProductForm] = useState({
    name: '',
    description: '',
    price: 0,
    quantity: 0,
    is_active: true
  })
  const [awardCoinsForm, setAwardCoinsForm] = useState({
    student_id: '',
    amount: 0,
    reason: ''
  })

  // Search & filter
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Statistics
  const [stats, setStats] = useState({
    totalProducts: 0,
    activeProducts: 0,
    totalOrders: 0,
    totalRevenue: 0
  })

  // Load data
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login')
      } else if (!user.is_staff && !user.is_superuser) {
        router.push('/dashboard')
        toast.error('Access denied')
      } else {
        loadData()
      }
    }
  }, [user, authLoading, router])

  const loadData = async () => {
    try {
      setLoading(true)
      await Promise.all([
        loadProducts(),
        loadOrders(),
        loadStudents()
      ])
    } catch (error) {
      console.error('Failed to load data:', error)
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const loadProducts = async () => {
    try {
      const data = await apiService.getShopProducts()
      setProducts(data.results || data)

      // Calculate stats
      const active = data.results?.filter((p: Product) => p.is_active).length || 0
      setStats(prev => ({
        ...prev,
        totalProducts: data.results?.length || 0,
        activeProducts: active
      }))
    } catch (error) {
      console.error('Failed to load products:', error)
    }
  }

  const loadOrders = async () => {
    try {
      const data = await apiService.getShopOrders()
      const ordersData = data.results || data
      setOrders(ordersData)

      // Calculate revenue
      const revenue = ordersData
        .filter((o: Order) => o.status === 'completed')
        .reduce((sum: number, o: Order) => sum + o.total_price, 0)

      setStats(prev => ({
        ...prev,
        totalOrders: ordersData.length,
        totalRevenue: revenue
      }))
    } catch (error) {
      console.error('Failed to load orders:', error)
    }
  }

  const loadStudents = async () => {
    try {
      const data = await apiService.getStudents()
      setStudents(data.results || data)
    } catch (error) {
      console.error('Failed to load students:', error)
    }
  }

  // Product CRUD operations
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await apiService.createShopProduct(productForm)
      toast.success('Product created successfully')
      setShowProductModal(false)
      resetProductForm()
      loadProducts()
    } catch (error) {
      console.error('Failed to create product:', error)
      toast.error('Failed to create product')
    }
  }

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingProduct) return

    try {
      await apiService.updateShopProduct(editingProduct.id, productForm)
      toast.success('Product updated successfully')
      setShowProductModal(false)
      setEditingProduct(null)
      resetProductForm()
      loadProducts()
    } catch (error) {
      console.error('Failed to update product:', error)
      toast.error('Failed to update product')
    }
  }

  const handleDeleteProduct = async (id: number) => {
    if (!confirm('Are you sure you want to delete this product?')) return

    try {
      await apiService.deleteShopProduct(id)
      toast.success('Product deleted successfully')
      loadProducts()
    } catch (error) {
      console.error('Failed to delete product:', error)
      toast.error('Failed to delete product')
    }
  }

  const handleAwardCoins = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await apiService.awardStudentCoins({
        student_id: parseInt(awardCoinsForm.student_id),
        amount: awardCoinsForm.amount,
        reason: awardCoinsForm.reason
      })
      toast.success('Coins awarded successfully')
      setShowAwardCoinsModal(false)
      resetAwardCoinsForm()
    } catch (error) {
      console.error('Failed to award coins:', error)
      toast.error('Failed to award coins')
    }
  }

  const resetProductForm = () => {
    setProductForm({
      name: '',
      description: '',
      price: 0,
      quantity: 0,
      is_active: true
    })
  }

  const resetAwardCoinsForm = () => {
    setAwardCoinsForm({
      student_id: '',
      amount: 0,
      reason: ''
    })
  }

  const openEditModal = (product: Product) => {
    setEditingProduct(product)
    setProductForm({
      name: product.name,
      description: product.description,
      price: product.price,
      quantity: product.quantity,
      is_active: product.is_active
    })
    setShowProductModal(true)
  }

  const openCreateModal = () => {
    setEditingProduct(null)
    resetProductForm()
    setShowProductModal(true)
  }

  // Filter products
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' ||
                         (statusFilter === 'active' && product.is_active) ||
                         (statusFilter === 'inactive' && !product.is_active)
    return matchesSearch && matchesStatus
  })

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="mt-4 text-text-secondary">Loading shop...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <ShoppingCart className="h-8 w-8 text-primary" />
            Shop & Rewards
          </h1>
          <p className="text-text-secondary">Manage products, orders, and student rewards</p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-surface p-6 rounded-2xl border border-border">
            <div className="flex items-center justify-between mb-2">
              <p className="text-text-secondary text-sm">Total Products</p>
              <Package className="h-5 w-5 text-primary" />
            </div>
            <p className="text-3xl font-bold">{stats.totalProducts}</p>
            <p className="text-xs text-text-secondary mt-1">
              {stats.activeProducts} active
            </p>
          </div>

          <div className="bg-surface p-6 rounded-2xl border border-border">
            <div className="flex items-center justify-between mb-2">
              <p className="text-text-secondary text-sm">Total Orders</p>
              <ShoppingCart className="h-5 w-5 text-warning" />
            </div>
            <p className="text-3xl font-bold">{stats.totalOrders}</p>
            <p className="text-xs text-text-secondary mt-1">All time</p>
          </div>

          <div className="bg-surface p-6 rounded-2xl border border-border">
            <div className="flex items-center justify-between mb-2">
              <p className="text-text-secondary text-sm">Revenue (Coins)</p>
              <Coins className="h-5 w-5 text-success" />
            </div>
            <p className="text-3xl font-bold">{stats.totalRevenue}</p>
            <p className="text-xs text-text-secondary mt-1">Completed orders</p>
          </div>

          <div className="bg-surface p-6 rounded-2xl border border-border">
            <div className="flex items-center justify-between mb-2">
              <p className="text-text-secondary text-sm">Avg Order Value</p>
              <TrendingUp className="h-5 w-5 text-info" />
            </div>
            <p className="text-3xl font-bold">
              {stats.totalOrders > 0 ? Math.round(stats.totalRevenue / stats.totalOrders) : 0}
            </p>
            <p className="text-xs text-text-secondary mt-1">Coins per order</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-border">
          <button
            onClick={() => setActiveTab('products')}
            className={`px-6 py-3 font-medium transition-colors border-b-2 ${
              activeTab === 'products'
                ? 'border-primary text-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <Package className="h-4 w-4 inline mr-2" />
            Products
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-6 py-3 font-medium transition-colors border-b-2 ${
              activeTab === 'orders'
                ? 'border-primary text-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <ShoppingCart className="h-4 w-4 inline mr-2" />
            Orders
          </button>
          <button
            onClick={() => setActiveTab('coins')}
            className={`px-6 py-3 font-medium transition-colors border-b-2 ${
              activeTab === 'coins'
                ? 'border-primary text-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <Coins className="h-4 w-4 inline mr-2" />
            Award Coins
          </button>
        </div>

        {/* Products Tab */}
        {activeTab === 'products' && (
          <div>
            {/* Filters and Actions */}
            <div className="bg-surface p-4 rounded-2xl border border-border mb-6">
              <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex-1 w-full md:w-auto relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-secondary" />
                  <input
                    type="text"
                    placeholder="Search products..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-4 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="all">All Products</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                  <button
                    onClick={openCreateModal}
                    className="px-4 py-2 bg-primary text-background rounded-xl hover:bg-primary/90 transition-colors flex items-center gap-2 font-medium"
                  >
                    <Plus className="h-5 w-5" />
                    Add Product
                  </button>
                </div>
              </div>
            </div>

            {/* Products Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  className="bg-surface border border-border rounded-2xl overflow-hidden hover:border-primary/50 transition-colors"
                >
                  {/* Product Image */}
                  <div className="h-48 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                    {product.image ? (
                      <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <Package className="h-16 w-16 text-primary/40" />
                    )}
                  </div>

                  {/* Product Info */}
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-bold text-lg">{product.name}</h3>
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                        product.is_active
                          ? 'bg-success/20 text-success'
                          : 'bg-error/20 text-error'
                      }`}>
                        {product.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="text-text-secondary text-sm mb-4 line-clamp-2">{product.description}</p>

                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Coins className="h-5 w-5 text-warning" />
                        <span className="text-xl font-bold">{product.price}</span>
                      </div>
                      <div className="text-sm text-text-secondary">
                        Stock: <span className="font-medium">{product.quantity}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEditModal(product)}
                        className="flex-1 px-4 py-2 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition-colors flex items-center justify-center gap-2 font-medium"
                      >
                        <Edit className="h-4 w-4" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(product.id)}
                        className="px-4 py-2 bg-error/10 text-error rounded-xl hover:bg-error/20 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {filteredProducts.length === 0 && (
              <div className="text-center py-12">
                <Package className="h-16 w-16 text-text-secondary/50 mx-auto mb-4" />
                <p className="text-text-secondary">No products found</p>
              </div>
            )}
          </div>
        )}

        {/* Orders Tab */}
        {activeTab === 'orders' && (
          <div>
            <div className="bg-surface rounded-2xl border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-background border-b border-border">
                    <tr>
                      <th className="text-left p-4 font-medium text-text-secondary">Order ID</th>
                      <th className="text-left p-4 font-medium text-text-secondary">Student</th>
                      <th className="text-left p-4 font-medium text-text-secondary">Product</th>
                      <th className="text-left p-4 font-medium text-text-secondary">Quantity</th>
                      <th className="text-left p-4 font-medium text-text-secondary">Total</th>
                      <th className="text-left p-4 font-medium text-text-secondary">Status</th>
                      <th className="text-left p-4 font-medium text-text-secondary">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.id} className="border-b border-border hover:bg-background transition-colors">
                        <td className="p-4">#{order.id}</td>
                        <td className="p-4">{order.student_name || `Student #${order.student}`}</td>
                        <td className="p-4">{order.product_name || `Product #${order.product}`}</td>
                        <td className="p-4">{order.quantity}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-1">
                            <Coins className="h-4 w-4 text-warning" />
                            <span className="font-medium">{order.total_price}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`px-3 py-1 rounded-lg text-xs font-medium ${
                            order.status === 'completed' ? 'bg-success/20 text-success' :
                            order.status === 'pending' ? 'bg-warning/20 text-warning' :
                            'bg-error/20 text-error'
                          }`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="p-4 text-text-secondary text-sm">
                          {new Date(order.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {orders.length === 0 && (
                <div className="text-center py-12">
                  <ShoppingCart className="h-16 w-16 text-text-secondary/50 mx-auto mb-4" />
                  <p className="text-text-secondary">No orders found</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Award Coins Tab */}
        {activeTab === 'coins' && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-surface rounded-2xl border border-border p-8">
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-warning/20 mb-4">
                  <Award className="h-8 w-8 text-warning" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Award Student Coins</h2>
                <p className="text-text-secondary">Reward students with coins for achievements</p>
              </div>

              <form onSubmit={handleAwardCoins} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Select Student</label>
                  <select
                    value={awardCoinsForm.student_id}
                    onChange={(e) => setAwardCoinsForm({ ...awardCoinsForm, student_id: e.target.value })}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  >
                    <option value="">Choose a student...</option>
                    {students.map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.first_name} {student.last_name} ({student.username})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Amount (Coins)</label>
                  <div className="relative">
                    <Coins className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-warning" />
                    <input
                      type="number"
                      min="1"
                      value={awardCoinsForm.amount || ''}
                      onChange={(e) => setAwardCoinsForm({ ...awardCoinsForm, amount: parseInt(e.target.value) || 0 })}
                      className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="Enter amount..."
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Reason</label>
                  <textarea
                    value={awardCoinsForm.reason}
                    onChange={(e) => setAwardCoinsForm({ ...awardCoinsForm, reason: e.target.value })}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                    rows={4}
                    placeholder="Why are you awarding these coins?"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="w-full px-6 py-3 bg-primary text-background rounded-xl hover:bg-primary/90 transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <Award className="h-5 w-5" />
                  Award Coins
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Product Modal */}
      {showProductModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-surface rounded-2xl border border-border w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border flex items-center justify-between sticky top-0 bg-surface z-10">
              <h2 className="text-xl font-bold">
                {editingProduct ? 'Edit Product' : 'Create Product'}
              </h2>
              <button
                onClick={() => {
                  setShowProductModal(false)
                  setEditingProduct(null)
                  resetProductForm()
                }}
                className="p-2 hover:bg-background rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={editingProduct ? handleUpdateProduct : handleCreateProduct} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Product Name</label>
                <input
                  type="text"
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Enter product name..."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea
                  value={productForm.description}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  rows={4}
                  placeholder="Describe the product..."
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Price (Coins)</label>
                  <div className="relative">
                    <Coins className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-warning" />
                    <input
                      type="number"
                      min="0"
                      value={productForm.price || ''}
                      onChange={(e) => setProductForm({ ...productForm, price: parseInt(e.target.value) || 0 })}
                      className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="0"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Stock</label>
                  <input
                    type="number"
                    min="0"
                    value={productForm.quantity || ''}
                    onChange={(e) => setProductForm({ ...productForm, quantity: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="0"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={productForm.is_active}
                    onChange={(e) => setProductForm({ ...productForm, is_active: e.target.checked })}
                    className="w-5 h-5 rounded border-border focus:ring-2 focus:ring-primary"
                  />
                  <span className="text-sm font-medium">Product is active</span>
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowProductModal(false)
                    setEditingProduct(null)
                    resetProductForm()
                  }}
                  className="flex-1 px-6 py-3 bg-background border border-border text-text-primary rounded-xl hover:bg-border/50 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-primary text-background rounded-xl hover:bg-primary/90 transition-colors font-medium"
                >
                  {editingProduct ? 'Update Product' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
