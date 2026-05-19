"use client"
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
                          pos.avg_price * pos.quantity
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
