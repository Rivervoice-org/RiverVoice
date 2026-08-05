import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export default function Home() {
  return (
    <main className="flex min-h-svh flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Rivervoice</CardTitle>
          <CardDescription>Next.js + Tailwind CSS + shadcn/ui</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Input placeholder="Phone number" />
          <Button className="w-full">Start call</Button>
        </CardContent>
      </Card>
    </main>
  )
}
