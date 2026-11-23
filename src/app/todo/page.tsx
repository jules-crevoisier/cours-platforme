import { redirect } from "next/navigation";

// « À faire » est désormais l'accueil ; on garde l'adresse pour les anciens liens et favoris.
export default function TodoPage() {
  redirect("/");
}
