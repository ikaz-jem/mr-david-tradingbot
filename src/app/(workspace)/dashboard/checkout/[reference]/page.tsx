import { PaymentCheckout } from "@/components/payment-checkout";
export default async function CheckoutPage({ params }: { params: Promise<{ reference: string }> }) { return <PaymentCheckout reference={(await params).reference}/>; }
