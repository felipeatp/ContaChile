import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '../lib/auth-context'
import { apiFetch } from '../lib/api'

interface Company {
  id: string
  rut: string
  name: string
}

interface Report {
  year: number
  ingresos: number
  costos: number
  gastos: number
  rentaLiquida: number
}

export default function DashboardScreen() {
  const [company, setCompany] = useState<Company | null>(null)
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const { logout } = useAuth()
  const router = useRouter()

  const load = async () => {
    setLoading(true)
    try {
      const [comp, rep] = await Promise.all([
        apiFetch('/public/v1/company'),
        apiFetch('/public/v1/accounting/reports'),
      ])
      setCompany(comp.company)
      setReport(rep)
    } catch (err) {
      console.warn(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(n)

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>{company?.name || '...'}</Text>
          <Text style={styles.headerRut}>{company?.rut || ''}</Text>
        </View>
        <TouchableOpacity onPress={() => logout().then(() => router.replace('/login'))}>
          <Text style={styles.logout}>Salir</Text>
        </TouchableOpacity>
      </View>

      {report && (
        <View style={styles.grid}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Ingresos {report.year}</Text>
            <Text style={styles.cardValue}>{formatCurrency(report.ingresos)}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Costos</Text>
            <Text style={styles.cardValue}>{formatCurrency(report.costos)}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Gastos</Text>
            <Text style={styles.cardValue}>{formatCurrency(report.gastos)}</Text>
          </View>
          <View style={[styles.card, styles.highlight]}>
            <Text style={styles.cardLabel}>Renta Líquida</Text>
            <Text style={styles.cardValue}>{formatCurrency(report.rentaLiquida)}</Text>
          </View>
        </View>
      )}

      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionButton} onPress={() => router.push('/camera')}>
          <Text style={styles.actionText}>📷 Capturar Gasto</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 48,
    backgroundColor: '#fff',
  },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  headerRut: { fontSize: 12, color: '#666', marginTop: 2 },
  logout: { fontSize: 12, color: '#c00', fontWeight: '600' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    gap: 12,
  },
  card: {
    width: '47%',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  highlight: { backgroundColor: '#e8f5e9' },
  cardLabel: { fontSize: 11, color: '#666', marginBottom: 6, textTransform: 'uppercase' },
  cardValue: { fontSize: 14, fontWeight: '700' },
  actions: { padding: 16 },
  actionButton: {
    backgroundColor: '#111',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  actionText: { color: '#fff', fontWeight: '600', fontSize: 14 },
})
