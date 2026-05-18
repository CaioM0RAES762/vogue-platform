'use client';

import { useState } from 'react';
import { Copy, Check, FileText, ExternalLink } from 'lucide-react';

interface BoletoPaymentProps {
  barcode: string | null;
  boletoUrl?: string | null;
  expiresAt: string | null;
}

export function BoletoPayment({ barcode, boletoUrl, expiresAt }: BoletoPaymentProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!barcode) return;
    await navigator.clipboard.writeText(barcode);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }

  const expiryDate = expiresAt
    ? new Date(expiresAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : null;

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex items-center gap-3 text-gray-700">
        <FileText className="w-8 h-8 text-[#C9A84C]" />
        <div>
          <p className="font-semibold">Boleto Bancário</p>
          {expiryDate && (
            <p className="text-sm text-gray-500">Vencimento: {expiryDate}</p>
          )}
        </div>
      </div>

      {barcode && (
        <div className="w-full max-w-md">
          <p className="text-xs text-gray-500 mb-2 font-medium">Código de barras:</p>
          <div className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="flex-1 text-xs font-mono text-gray-700 break-all">
              {barcode}
            </p>
            <button
              onClick={handleCopy}
              className="shrink-0 flex items-center gap-1 px-3 py-1.5 bg-[#C9A84C] hover:bg-[#b8973e] text-white text-xs font-medium rounded-md transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3" />
                  Copiado!
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  Copiar
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {boletoUrl && (
        <a
          href={boletoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
        >
          <ExternalLink className="w-4 h-4" />
          Visualizar / Imprimir Boleto
        </a>
      )}

      <p className="text-xs text-gray-400 text-center max-w-xs">
        O pagamento pode levar até 3 dias úteis para ser confirmado após o pagamento.
      </p>
    </div>
  );
}
