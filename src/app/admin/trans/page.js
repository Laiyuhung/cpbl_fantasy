'use client'

import { useState, useEffect } from 'react'

export default function TransPage() {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [allMonthsData, setAllMonthsData] = useState([])
  const [loadingAll, setLoadingAll] = useState(false)
  const [savedCount, setSavedCount] = useState(0)

  const months = Array.from({ length: 12 }, (_, i) => (i + 1))
  const years = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i))

  const fetchAndSaveTransactions = async (month, year, saveToDb = true) => {
    setLoading(true)
    setError('')
    setSavedCount(0)
    try {
      const response = await fetch(`/api/cpbl-trans?month=${month}&year=${year}&save=${saveToDb}`)
      const data = await response.json()
      
      if (data.success) {
        setTransactions(data.transactions)
        if (data.savedCount !== undefined) {
          setSavedCount(data.savedCount)
        }
      } else {
        setError(data.error || 'Failed to fetch transactions')
      }
    } catch (err) {
      setError('Error fetching data: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  // 頁面載入時自動爬取當月資料
  useEffect(() => {
    const currentMonth = new Date().getMonth() + 1
    const currentYear = new Date().getFullYear()
    fetchAndSaveTransactions(currentMonth, currentYear, true)
  }, [])

  const fetchAllMonths = async () => {
    setLoadingAll(true)
    setError('')
    const allData = []
    let totalSaved = 0
    
    try {
      for (let month = 1; month <= 12; month++) {
        const response = await fetch(`/api/cpbl-trans?month=${month}&year=${selectedYear}&save=true`)
        const data = await response.json()
        
        if (data.success && data.transactions.length > 0) {
          allData.push({
            month,
            transactions: data.transactions,
            savedCount: data.savedCount || 0
          })
          totalSaved += (data.savedCount || 0)
        }
        
        // 稍微延遲避免請求過快
        await new Promise(resolve => setTimeout(resolve, 500))
      }
      
      setAllMonthsData(allData)
      setSavedCount(totalSaved)
    } catch (err) {
      setError('Error fetching all months: ' + err.message)
    } finally {
      setLoadingAll(false)
    }
  }

  const handleMonthChange = (month, year) => {
    setSelectedMonth(month)
    setSelectedYear(year)
    fetchAndSaveTransactions(month, year, true)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 bg-gradient-to-r from-purple-600/20 to-blue-600/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl p-8 shadow-2xl">
          <h1 className="text-5xl font-black bg-gradient-to-r from-purple-300 via-pink-300 to-blue-300 bg-clip-text text-transparent">
            CPBL Player Transactions
          </h1>
          {savedCount > 0 && (
            <div className="mt-4 text-green-400 bg-green-900/30 border border-green-500/50 rounded-lg p-3">
              ✅ Saved {savedCount} transactions to database
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="bg-gradient-to-br from-purple-600/20 to-blue-600/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl p-6 mb-6 shadow-2xl">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-purple-300 text-sm font-semibold mb-2">Year</label>
              <select
                value={selectedYear}
                onChange={(e) => {
                  const newYear = parseInt(e.target.value)
                  setSelectedYear(newYear)
                  handleMonthChange(selectedMonth, newYear)
                }}
                className="bg-slate-800/60 border border-purple-500/30 text-white p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {years.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-purple-300 text-sm font-semibold mb-2">Month</label>
              <select
                value={selectedMonth}
                onChange={(e) => {
                  const newMonth = parseInt(e.target.value)
                  setSelectedMonth(newMonth)
                  handleMonthChange(newMonth, selectedYear)
                }}
                className="bg-slate-800/60 border border-purple-500/30 text-white p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {months.map(month => (
                  <option key={month} value={month}>{month}月</option>
                ))}
              </select>
            </div>

            <button
              onClick={() => fetchAndSaveTransactions(selectedMonth, selectedYear, true)}
              disabled={loading}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-all shadow-lg hover:shadow-purple-500/50 disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Refresh & Save'}
            </button>

            <button
              onClick={fetchAllMonths}
              disabled={loadingAll}
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-3 px-6 rounded-lg transition-all shadow-lg hover:shadow-green-500/50 disabled:opacity-50"
            >
              {loadingAll ? 'Loading All...' : 'Fetch & Save All Months'}
            </button>
          </div>

          {error && (
            <div className="mt-4 text-red-400 bg-red-900/30 border border-red-500/50 rounded-lg p-3">
              ⚠️ {error}
            </div>
          )}
        </div>

        {/* Single Month View */}
        {!loadingAll && allMonthsData.length === 0 && (
          <div className="bg-gradient-to-br from-purple-600/20 to-blue-600/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600/80 to-cyan-600/80 backdrop-blur-sm p-6 border-b border-blue-400/30">
              <h2 className="text-3xl font-black text-white">
                {selectedYear} Year - {selectedMonth} Month Transactions
              </h2>
            </div>
            <div className="overflow-x-auto">
              {loading ? (
                <div className="text-center py-12">
                  <div className="w-12 h-12 mx-auto mb-4 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                  <div className="text-purple-300">Loading transactions...</div>
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-12 text-purple-300/70 text-lg">
                  No transactions found for this period
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-slate-800/60">
                    <tr>
                      <th className="px-6 py-4 text-left text-purple-300 font-bold">Date</th>
                      <th className="px-6 py-4 text-left text-purple-300 font-bold">Player</th>
                      <th className="px-6 py-4 text-left text-purple-300 font-bold">Team</th>
                      <th className="px-6 py-4 text-left text-purple-300 font-bold">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-purple-500/20">
                    {transactions.map((trans, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4 text-white">{trans.date}</td>
                        <td className="px-6 py-4 text-white font-semibold">{trans.player}</td>
                        <td className="px-6 py-4 text-purple-300">{trans.team}</td>
                        <td className="px-6 py-4 text-purple-200">{trans.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* All Months View */}
        {allMonthsData.length > 0 && (
          <div className="space-y-6">
            <button
              onClick={() => setAllMonthsData([])}
              className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded-lg transition-all"
            >
              ← Back to Single Month View
            </button>

            {allMonthsData.map((monthData) => (
              <div key={monthData.month} className="bg-gradient-to-br from-purple-600/20 to-blue-600/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl shadow-2xl overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600/80 to-cyan-600/80 backdrop-blur-sm p-6 border-b border-blue-400/30">
                  <h2 className="text-3xl font-black text-white">
                    {selectedYear} Year - {monthData.month} Month ({monthData.transactions.length} transactions)
                    {monthData.savedCount > 0 && (
                      <span className="ml-4 text-green-300 text-lg">✅ {monthData.savedCount} saved</span>
                    )}
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-800/60">
                      <tr>
                        <th className="px-6 py-4 text-left text-purple-300 font-bold">Date</th>
                        <th className="px-6 py-4 text-left text-purple-300 font-bold">Player</th>
                        <th className="px-6 py-4 text-left text-purple-300 font-bold">Team</th>
                        <th className="px-6 py-4 text-left text-purple-300 font-bold">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-purple-500/20">
                      {monthData.transactions.map((trans, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                          <td className="px-6 py-4 text-white">{trans.date}</td>
                          <td className="px-6 py-4 text-white font-semibold">{trans.player}</td>
                          <td className="px-6 py-4 text-purple-300">{trans.team}</td>
                          <td className="px-6 py-4 text-purple-200">{trans.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
