import { useAuthStore } from '@/stores/authStore'
import { AdminDashboard } from '@/components/dashboard/AdminDashboard'
import { ApproverDashboard } from '@/components/dashboard/ApproverDashboard'
import { RequesterDashboard } from '@/components/dashboard/RequesterDashboard'

export function Dashboard() {
  const { user } = useAuthStore()

  if (!user) return null

  switch (user.role) {
    case 'admin':
      return <AdminDashboard />
    case 'approver':
      return <ApproverDashboard />
    case 'requester':
    default:
      return <RequesterDashboard />
  }
}
