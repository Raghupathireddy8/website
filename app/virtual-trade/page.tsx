"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"

export default function ResetPasswordPage() {

  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(false)

  async function updatePassword() {

    if (password !== confirm) {
      setMessage("Passwords do not match")
      return
    }

    setLoading(true)

    const { error } =
      await supabase.auth.updateUser({
        password,
      })

    if (error) {
      setMessage(error.message)
    } else {
      setMessage(
        "Password updated successfully"
      )
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f7ff] px-4">

      <div className="w-full max-w-md bg-white border border-gray-100 rounded-3xl p-8 shadow-sm">

        <h1 className="text-3xl font-bold mb-6">
          Reset Password
        </h1>

        <div className="space-y-4">

          <input
            type="password"
            placeholder="New Password"
            value={password}
            onChange={(e) =>
              setPassword(e.target.value)
            }
            className="w-full h-12 border border-gray-200 rounded-2xl px-4"
          />

          <input
            type="password"
            placeholder="Confirm Password"
            value={confirm}
            onChange={(e) =>
              setConfirm(e.target.value)
            }
            className="w-full h-12 border border-gray-200 rounded-2xl px-4"
          />

          <button
            onClick={updatePassword}
            disabled={loading}
            className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-semibold"
          >
            {loading
              ? "Updating..."
              : "Update Password"}
          </button>

          {message && (
            <div className="text-center text-sm text-gray-600 pt-2">
              {message}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
