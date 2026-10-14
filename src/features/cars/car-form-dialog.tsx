"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { CarFront, PencilLine } from "lucide-react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { applyServerErrors } from "@/components/form/apply-server-errors"
import { FormDialog } from "@/components/form/form-dialog"
import { digitsOnly, TextField } from "@/components/form/text-field"
import { FieldGroup, FieldSeparator } from "@/components/ui/field"

import { carsResource } from "./queries"
import { carSchema, carTitle, emptyCar, toCarFormValues, type CarFormValues, type CarInput, type CarRow } from "./schema"

const BRANDS = ["Toyota", "Nissan", "Mazda", "Subaru", "Honda", "Mitsubishi", "Isuzu", "Suzuki", "Mercedes-Benz", "BMW", "Volkswagen", "Land Rover", "Lexus", "Audi", "Ford"]
const BODY_TYPES = ["Sedan", "Hatchback", "SUV", "Station Wagon", "Pickup", "Van", "Minivan", "Coupe", "Truck"]

export function CarFormDialog({
  car,
  open,
  onOpenChange,
}: {
  car?: CarRow
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const isEdit = Boolean(car)
  const save = carsResource.useSave()
  const form = useForm<CarFormValues, unknown, CarInput>({
    resolver: zodResolver(carSchema),
    defaultValues: car ? toCarFormValues(car) : emptyCar,
    mode: "onTouched",
  })

  const onSubmit = form.handleSubmit(async () => {
    try {
      const saved = await save.mutateAsync({ id: car?.id, values: form.getValues() })
      toast.success(isEdit ? "Vehicle updated" : "Vehicle added", { description: carTitle(saved) })
      onOpenChange(false)
    } catch (error) {
      applyServerErrors(error, form.setError)
    }
  })

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={isEdit ? PencilLine : CarFront}
      title={isEdit ? "Edit vehicle" : "Add vehicle"}
      description={isEdit ? "Update this vehicle's details." : "Add a vehicle or record a trade-in."}
      submitLabel={isEdit ? "Save changes" : "Add vehicle"}
      isSubmitting={form.formState.isSubmitting}
      onSubmit={onSubmit}
    >
      <datalist id="car-brands">
        {BRANDS.map((brand) => (
          <option key={brand} value={brand} />
        ))}
      </datalist>
      <datalist id="car-body-types">
        {BODY_TYPES.map((type) => (
          <option key={type} value={type} />
        ))}
      </datalist>
      <FieldGroup className="gap-5">
        <div className="grid gap-5 sm:grid-cols-3">
          <TextField control={form.control} name="brand" label="Brand" placeholder="Toyota" list="car-brands" autoFocus />
          <TextField control={form.control} name="name" label="Model" placeholder="Axio" />
          <TextField
            control={form.control}
            name="year"
            label="Year"
            placeholder="2018"
            inputMode="numeric"
            maxLength={4}
            sanitize={digitsOnly}
          />
          <TextField control={form.control} name="bodyType" label="Body type" placeholder="Sedan" list="car-body-types" />
          <TextField control={form.control} name="color" label="Color" placeholder="Pearl White" />
          <TextField
            control={form.control}
            name="cc"
            label="Engine (cc)"
            placeholder="1500"
            inputMode="numeric"
            maxLength={5}
            sanitize={digitsOnly}
          />
        </div>
        <FieldSeparator>Identification — Chassis No or Registration No required</FieldSeparator>
        <div className="grid gap-5 sm:grid-cols-3">
          <TextField control={form.control} name="regNo" label="Registration No" placeholder="KDD 123A" maxLength={9} />
          <TextField control={form.control} name="chassisNo" label="Chassis No" placeholder="NZE161-3012345" maxLength={30} />
          <TextField control={form.control} name="engineNo" label="Engine No" optional placeholder="1NZ-A123456" maxLength={30} />
        </div>
      </FieldGroup>
    </FormDialog>
  )
}
