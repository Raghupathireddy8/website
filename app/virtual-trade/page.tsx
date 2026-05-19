"use client"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"

const EQUITY_SYMBOLS = [
  "RELIANCE",
  "TCS",
  "INFY",
  "HDFCBANK",
  "ICICIBANK",
  "SBIN",
  "LT",
  "ITC",
  "AXISBANK",
  "KOTAKBANK",
  "BHARTIARTL",
  "ASIANPAINT",
  "MARUTI",
  "SUNPHARMA",
  "TITAN",
  "WIPRO",
  "ONGC",
  "TATAMOTORS",
  "BAJFINANCE",
  "HCLTECH",
]

type InstrumentType =
  | "EQUITY"
  | "OPTIONS"
  | "FUTURES"

type TradeType = "BUY" | "SELL"

function formatIndianCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
  }).format(amount)
}

export default function VirtualTradePage() {
  const [userId, setUserId] = useState<string | null>(null)

  const [balance, setBalance] = useState(1000000)

  const [positions, setPositions] = useState<any[]>([])

  const [symbol, setSymbol] =
    useState("RELIANCE")

  const [inst, setInst] =
    useState<InstrumentType>("EQUITY")

  const [side, setSide] =
    useState<TradeType>("BUY")

  const [quantity, setQuantity] = useState(1)

  const [price, setPrice] = useState(2500)

  const [expiry, setExpiry] = useState("")

  const [strike, setStrike] = useState(0)

  const [optType, setOptType] = useState("CE")

  const [loading, setLoading] = useState(false)

  const [error, setError] = useState("")

  const [success, setSuccess] = useState("")

  useEffect(() => {
    loadUser()
  }, [])

  async function loadUser() {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.user?.id) return

    setUserId(session.user.id)

    loadWallet(session.user.id)

    loadPositions(session.user.id)
  }

  async function loadWallet(uid: string) {
    const { data } = await supabase
      .from("wallets")
      .select("balance")
      .eq("user_id", uid)
      .single()

    if (data?.balance) {
      setBalance(data.balance)
    }
  }

  async function loadPositions(uid: string) {
    const { data } = await supabase
      .from("positions")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", {
        ascending: false,
      })

    if (data) {
      setPositions(data)
    }
  }

  const turnover = useMemo(() => {
    return quantity * price
  }, [quantity, price])

  async function placeTrade() {
    try {
      setLoading(true)

      setError("")

      setSuccess("")

      if (!userId) {
        setError("Please login first")
        return
      }

      const net = turnover

      if (side === "BUY" && balance < net) {
        setError("Insufficient balance")
        return
      }

      const { error: posError } =
        await supabase
          .from("positions")
          .insert({
            user_id: userId,
            symbol,
            instrument_type: inst,
            trade_type: side,
            quantity,
            avg_price: price,
            current_price: price,
            expiry: expiry || null,
            strike_price:
              inst === "OPTIONS"
                ? strike
                : null,
            option_type:
              inst === "OPTIONS"
                ? optType
                : null,
            status: "OPEN",
            pnl: 0,
          })

      if (posError) {
        setError(posError.message)
        return
      }

      const updatedBalance =
        side === "BUY"
          ? balance - net
          : balance + net

      const { error: walletError } =
        await supabase
          .from("wallets")
          .update({
            balance: updatedBalance,
            updated_at:
              new Date().toISOString(),
          })
          .eq("user_id", userId)

      if (walletError) {
        setError(walletError.message)
        return
      }

      setBalance(updatedBalance)

      setSuccess(
        "Trade executed successfully"
      )

      loadPositions(userId)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f7ff] p-6">
      <div className="max-w-7xl mx-auto">

        <div className="mb-8">
          <h1 className="text-4xl font-bold text-[#101828]">
            Virtual Trading
          </h1>

          <p className="text-gray-500 mt-2">
            Practice trading using
            virtual money.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">

          <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">

            <h2 className="text-2xl font-semibold mb-6">
              Place Order
            </h2>

            <div className="space-y-4">

              <select
                value={symbol}
                onChange={(e) =>
                  setSymbol(e.target.value)
                }
                className="w-full h-12 border border-gray-200 rounded-2xl px-4"
              >
                {EQUITY_SYMBOLS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>

              <select
                value={inst}
                onChange={(e) =>
                  setInst(
                    e.target
                      .value as InstrumentType
                  )
                }
                className="w-full h-12 border border-gray-200 rounded-2xl px-4"
              >
                <option value="EQUITY">
                  Equity
                </option>

                <option value="OPTIONS">
                  Options
                </option>

                <option value="FUTURES">
                  Futures
                </option>
              </select>

              <select
                value={side}
                onChange={(e) =>
                  setSide(
                    e.target.value as TradeType
                  )
                }
                className="w-full h-12 border border-gray-200 rounded-2xl px-4"
              >
                <option value="BUY">
                  BUY
                </option>

                <option value="SELL">
                  SELL
                </option>
              </select>

              <input
                type="number"
                value={quantity}
                onChange={(e) =>
                  setQuantity(
                    Number(e.target.value)
                  )
                }
                placeholder="Quantity"
                className="w-full h-12 border border-gray-200 rounded-2xl px-4"
              />

              <input
                type="number"
                value={price}
                onChange={(e) =>
                  setPrice(
                    Number(e.target.value)
                  )
                }
                placeholder="Price"
                className="w-full h-12 border border-gray-200 rounded-2xl px-4"
              />

              {inst === "OPTIONS" && (
                <>
                  <input
                    type="number"
                    value={strike}
                    onChange={(e) =>
                      setStrike(
                        Number(
                          e.target.value
                        )
                      )
                    }
                    placeholder="Strike Price"
                    className="w-full h-12 border border-gray-200 rounded-2xl px-4"
                  />

                  <select
                    value={optType}
                    onChange={(e) =>
                      setOptType(
                        e.target.value
                      )
                    }
                    className="w-full h-12 border border-gray-200 rounded-2xl px-4"
                  >
                    <option value="CE">
                      CE
                    </option>

                    <option value="PE">
                      PE
                    </option>
                  </select>

                  <input
                    type="date"
                    value={expiry}
                    onChange={(e) =>
                      setExpiry(
                        e.target.value
                      )
                    }
                    className="w-full h-12 border border-gray-200 rounded-2xl px-4"
                  />
                </>
              )}

              <div className="bg-[#f5f7ff] rounded-2xl p-4">
                <div className="flex justify-between">
                  <span>Total Amount</span>

                  <span>
                    ₹
                    {formatIndianCurrency(
                      turnover
                    )}
                  </span>
                </div>
              </div>

              <button
                onClick={placeTrade}
                disabled={loading}
                className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-semibold"
              >
                {loading
                  ? "Processing..."
                  : "Place Order"}
              </button>

              {error && (
                <div className="bg-red-100 text-red-600 p-3 rounded-xl text-sm">
                  {error}
                </div>
              )}

              {success && (
                <div className="bg-green-100 text-green-600 p-3 rounded-xl text-sm">
                  {success}
                </div>
              )}

              <div className="text-xs text-gray-500">
                Virtual trading only.
                Real broker charges may
                apply during actual
                trading.
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">

            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold">
                Open Positions
              </h2>

              <div className="bg-[#f5f7ff] rounded-2xl px-5 py-3 font-semibold">
                Balance:
                ₹
                {formatIndianCurrency(
                  balance
                )}
              </div>
            </div>

            <div className="overflow-auto">
              <table className="w-full">

                <thead>
                  <tr className="border-b border-gray-100 text-left text-gray-500 text-sm">

                    <th className="py-3">
                      Symbol
                    </th>

                    <th className="py-3">
                      Type
                    </th>

                    <th className="py-3">
                      Qty
                    </th>

                    <th className="py-3">
                      Price
                    </th>

                    <th className="py-3">
                      Value
                    </th>

                    <th className="py-3">
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {positions.map((pos) => (
                    <tr
                      key={pos.id}
                      className="border-b border-gray-50"
                    >
                      <td className="py-4">

                        <div className="font-semibold">
                          {pos.symbol}
                        </div>

                        {pos.instrument_type ===
                          "OPTIONS" && (
                          <div className="text-[10px] text-gray-500 mt-1">

                            {pos.strike_price}
                            {" "}
                            {pos.option_type}

                            <br />

                            Exp:
                            {" "}

                            {new Date(
                              pos.expiry
                            ).toLocaleDateString(
                              "en-IN",
                              {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              }
                            )}
                          </div>
                        )}
                      </td>

                      <td className="py-4">
                        {pos.instrument_type}
                      </td>

                      <td className="py-4">
                        {pos.quantity}
                      </td>

                      <td className="py-4">
                        ₹
                        {formatIndianCurrency(
                          pos.avg_price
                        )}
                      </td>

                      <td className="py-4">
                        ₹
                        {formatIndianCurrency(
                          pos.avg_price *
                            pos.quantity
                        )}
                      </td>

                      <td className="py-4">
                        <span className="bg-green-100 text-green-600 px-3 py-1 rounded-full text-xs font-semibold">
                          {pos.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>

              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
