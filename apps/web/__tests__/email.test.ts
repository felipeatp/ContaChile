const mockSend = jest.fn().mockResolvedValue({ data: { id: "x" }, error: null })

jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({ emails: { send: mockSend } })),
}))

import { sendPasswordResetEmail } from "@/lib/email"

describe("sendPasswordResetEmail", () => {
  const OLD_ENV = process.env

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = { ...OLD_ENV }
  })

  afterAll(() => {
    process.env = OLD_ENV
  })

  it("envía vía Resend con el link cuando hay API key", async () => {
    process.env.RESEND_API_KEY = "re_test"
    await sendPasswordResetEmail({
      to: "u@x.cl",
      url: "https://app/reset?token=abc",
      userName: "Ana",
    })
    expect(mockSend).toHaveBeenCalledTimes(1)
    const arg = mockSend.mock.calls[0][0]
    expect(arg.to).toBe("u@x.cl")
    expect(arg.subject).toMatch(/contraseña/i)
    expect(arg.html).toContain("https://app/reset?token=abc")
    expect(arg.from).toMatch(/@/)
  })

  it("usa EMAIL_FROM cuando está definido", async () => {
    process.env.RESEND_API_KEY = "re_test"
    process.env.EMAIL_FROM = "Soporte <soporte@miempresa.cl>"
    await sendPasswordResetEmail({ to: "u@x.cl", url: "https://app/reset" })
    expect(mockSend.mock.calls[0][0].from).toBe("Soporte <soporte@miempresa.cl>")
  })

  it("hace no-op sin API key (no llama a Resend)", async () => {
    delete process.env.RESEND_API_KEY
    await sendPasswordResetEmail({ to: "u@x.cl", url: "https://app/reset" })
    expect(mockSend).not.toHaveBeenCalled()
  })

  it("hace no-op con la key placeholder test-key", async () => {
    process.env.RESEND_API_KEY = "test-key"
    await sendPasswordResetEmail({ to: "u@x.cl", url: "https://app/reset" })
    expect(mockSend).not.toHaveBeenCalled()
  })
})
