"use client"

import { Modal } from "@/components/ui/modal"
import { Button } from "@/components/ui/button"

interface ConfirmModalProps {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
  destructive?: boolean
}

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  onConfirm,
  onCancel,
  destructive = false,
}: ConfirmModalProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      size="sm"
      title={title}
      description={description}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            onClick={onConfirm}
            className={
              destructive
                ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                : ""
            }
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <div />
    </Modal>
  )
}
