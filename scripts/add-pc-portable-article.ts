/**
 * Publish (or refresh) the "Quel PC portable choisir au Maroc en 2026"
 * buying guide, grounded in the October 2026 technology catalogue.
 *
 *   npx tsx scripts/add-pc-portable-article.ts
 *
 * Idempotent: the article is upserted by slug, so it can be re-run on
 * production after `prisma db push`.
 */
import { readFileSync, existsSync } from "fs";
import { PrismaClient } from "@prisma/client";

function loadDotEnv(): void {
  const path = `${process.cwd()}/.env`;
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const key = trimmed.slice(0, trimmed.indexOf("=")).trim();
    if (process.env[key] !== undefined) continue;
    let value = trimmed.slice(trimmed.indexOf("=") + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadDotEnv();

const SLUG = "quel-pc-portable-choisir-maroc-2026-guide-budget";
const ARTICLE_SLUG =
  "le-meilleur-de-la-technologie-1-octobre-31-octobre-2026";

const TITLE = "Quel PC portable choisir au Maroc en 2026 ? Guide par budget";

const META_DESCRIPTION =
  "Comparatif des PC portables i3, i5 et i7 repérés dans le catalogue Marjane d'octobre 2026 : prix, RAM, SSD et conseils selon votre budget.";

const EXCERPT =
  "i3, i5 ou i7 ? Nous avons comparé les PC portables du catalogue Marjane d'octobre 2026 et détaillé ce que changent réellement la RAM et le SSD selon votre budget.";

function buildContent(catalogueSlug: string, catalogueTitle: string, dates: string): string {
  return `Le catalogue Marjane « ${catalogueTitle} », valable du ${dates}, consacre plusieurs pages à l'informatique. On y trouve des PC portables signés HP, MSI, Asus et Lenovo, avec des profils très différents : du modèle d'entrée de gamme pour la bureautique à la machine de jeu. Les prix cités ci-dessous sont ceux affichés dans ce catalogue au moment de la rédaction ; ils peuvent évoluer et doivent être vérifiés en magasin.

Avant de comparer les modèles, rappelons une évidence : le nom du processeur ne suffit pas. Un i5 récent et bien refroidi peut être plus agréable qu'un i7 ancien. La quantité de RAM, le type de SSD et la qualité de l'écran comptent autant que le logo Intel. Ce guide part donc du processeur, puis replace chaque modèle dans son usage réel.

## i3, i5 ou i7 : ce qui change vraiment

Un Core i3 est conçu pour les tâches simples : navigation, bureautique, vidéos, visioconférence. Il consomme peu et coûte généralement moins cher. Sur un PC portable d'entrée de gamme, il fait le travail, mais il montre ses limites si vous ouvrez beaucoup d'onglets, si vous montez des vidéos ou si vous utilisez des logiciels de création.

Un Core i5 se situe au milieu de la gamme. Il offre plus de cœurs et de fréquences qu'un i3, ce qui améliore le multitâche et les tâches un peu plus lourdes : retouche photo légère, tableur volumineux, petits montages. C'est le choix le plus polyvalent pour la majorité des familles et des étudiants.

Un Core i7 vise les usages intensifs : plusieurs applications lourdes en même temps, montage vidéo, développement, 3D légère. Il coûte plus cher et chauffe davantage, donc il faut vérifier le système de refroidissement et l'autonomie. Si vous ne faites que du web et de la bureautique, payer un i7 revient souvent à financer une puissance que vous n'utiliserez pas.

## Les PC portables repérés dans le catalogue

| Modèle | Prix catalogue | RAM | SSD | Écran | Pour qui ? |
|--------|----------------|-----|-----|-------|------------|
| HP 250 Core i3 | 5 499 DH (au lieu de 6 999 DH) | 8 Go | 256 Go | 15,6 pouces | Bureautique, web, cours |
| MSI Core i5 | 7 299 DH (au lieu de 8 999 DH) | 16 Go | 512 Go | 14 pouces | Usage familial et étudiant polyvalent |
| Asus X1502V i5 | 7 499 DH (au lieu de 8 999 DH) | 16 Go | 512 Go | 15,6 pouces | Même profil, écran plus grand |
| Asus Core i7 X1504VA | 8 499 DH (au lieu de 10 999 DH) | 16 Go | 1 To | 15,6 pouces | Gros fichiers, multitâche intensif |
| Lenovo LOQ i5 RTX3050 | 11 499 DH (au lieu de 13 999 DH) | 16 Go | 512 Go | 15,6 pouces | Jeu et création graphique |

Derrière ces étiquettes, les configurations ne sont pas équivalentes. Le [HP 250 Core i3](/produit/pc-portable-250-core-i3) à 5 499 DH est le modèle le plus accessible de la sélection, avec 8 Go de RAM et un SSD de 256 Go. Marjane indique qu'une sacoche est offerte. C'est une configuration suffisante pour un lycéen ou un usage bureautique simple, à condition d'accepter un stockage limité.

Le [MSI Core i5](/produit/pc-portable-core-i5) à 7 299 DH passe à 16 Go de RAM et 512 Go de SSD, dans un écran de 14 pouces. Pour 1 800 DH de plus que le i3, vous doublez la mémoire et le stockage : c'est le modèle qui demande le moins de compromis pour un usage familial ou étudiant.

L'[Asus X1502V i5](/produit/pc-portable-x1502v-i5) à 7 499 DH propose la même base de 16 Go de RAM et 512 Go de SSD, mais avec un écran de 15,6 pouces. Si vous travaillez souvent sur tableur ou si vous regardez des vidéos, ce pouce supplémentaire change le confort au quotidien.

L'[Asus Core i7 X1504VA](/produit/pc-portable-core-i7-x1504va) à 8 499 DH ajoute un SSD de 1 To et un processeur i7. C'est le choix à considérer si vous manipulez de gros fichiers ou plusieurs applications en parallèle. Le gain par rapport au i5 dépendra de votre usage : pour du web, il ne sera pas visible.

Enfin, le [Lenovo LOQ i5 RTX3050](/produit/pc-gaming-loq-i5-rtx3050) à 11 499 DH ne joue pas la même carte : sa carte graphique dédiée RTX 3050 le destine au jeu et à certains logiciels de création. Ce n'est pas un ultraportable : il est plus lourd et plus gourmand.

Le catalogue contient aussi des modèles AMD, comme l'Asus E1504 R3 à 5 999 DH ou le Lenovo IPS R5 à 6 499 DH. Ils peuvent être de bonnes options, mais ils sortent du cadre de ce comparatif i3, i5 et i7. Pour voir toutes les références et les pages du catalogue, consultez le [catalogue Marjane en cours](/catalogue-marjane/${catalogueSlug}).

## RAM : 8 Go ou 16 Go ?

Windows, un navigateur avec plusieurs onglets et une visioconférence peuvent déjà occuper 6 à 7 Go de mémoire. Avec 8 Go, il reste peu de marge : le PC fonctionne, mais il ralentit dès que vous empilez les tâches. C'est acceptable pour un usage scolaire simple, moins confortable pour plusieurs années d'études ou pour le télétravail.

16 Go apportent une vraie marge. On peut garder un tableur, des onglets et un logiciel de visioconférence ouverts sans que la machine ne sature. C'est la quantité que je recommande par défaut en 2026, surtout si vous voulez garder le PC trois à cinq ans.

Un point à vérifier avant l'achat : la mémoire est-elle soudée ou remplaçable ? Les fiches du catalogue ne le précisent pas toujours. Si vous prévoyez d'ajouter de la RAM plus tard, cherchez la référence exacte du modèle sur le site du fabricant avant de payer.

## SSD : 256 Go, 512 Go ou 1 To ?

Un SSD rend le système beaucoup plus réactif qu'un disque dur, et tous les modèles de cette sélection en sont équipés. La question porte donc sur la capacité. Après Windows et les logiciels, un SSD de 256 Go laisse environ 200 Go utiles : c'est juste si vous stockez des photos, des vidéos ou plusieurs jeux.

512 Go est le bon compromis pour la plupart des usages : système, logiciels, documents et quelques fichiers multimédias. Un 1 To devient pertinent si vous montez des vidéos, si vous téléchargez de gros jeux ou si vous ne voulez pas gérer d'espace pendant plusieurs années.

## Quel budget pour quel usage ?

### Jusqu'à 5 500 DH

Le HP 250 Core i3 est le seul modèle de la sélection dans cette tranche. Pour un budget serré, il couvre la bureautique, le web et les cours. Il faut simplement accepter ses 8 Go de RAM et ses 256 Go de stockage, qui limitent le multitâche et le stockage de fichiers lourds.

### Entre 7 000 et 7 500 DH

C'est la tranche la plus intéressante du catalogue. Le MSI Core i5 à 7 299 DH et l'Asus X1502V i5 à 7 499 DH offrent tous les deux 16 Go de RAM et 512 Go de SSD. La différence se joue surtout sur l'écran : 14 pouces pour le MSI, plus compact et facile à transporter, contre 15,6 pouces pour l'Asus, plus confortable à la maison.

### 8 500 DH et plus

L'Asus Core i7 X1504VA à 8 499 DH s'adresse à ceux qui ont besoin de plus de puissance et de stockage. Pour le jeu, le Lenovo LOQ i5 RTX3050 à 11 499 DH est plus adapté grâce à sa carte graphique dédiée, mais il faut accepter un encombrement et une consommation plus élevés.

## Notre recommandation

À titre personnel, je choisirais le MSI Core i5 à 7 299 DH. C'est le meilleur compromis de cette sélection pour la majorité des acheteurs, et voici pourquoi : il double la RAM et le stockage du modèle i3 pour 1 800 DH de plus, tout en restant sous la barre des 7 500 DH. Sur trois ou quatre ans, ces 16 Go et ces 512 Go évitent les ralentissements et la gestion permanente de l'espace disque.

Si vous avez besoin d'un grand écran, l'Asus X1502V i5 à 7 499 DH est le choix logique pour 200 DH de plus. Si votre budget est strictement limité à 5 500 DH, le HP i3 fera le travail pour un usage simple ; je ne le recommanderais toutefois pas pour cinq ans d'études intensives avec beaucoup de logiciels.

Le i7 ne se justifie que si vous montez des vidéos, compilez du code ou travaillez avec de gros fichiers. Pour le web et la bureautique, le supplément de prix ne se traduira pas par un gain perceptible. Enfin, pour le jeu, aucun modèle i3/i5/i7 de bureautique ne remplacera une carte graphique dédiée : le Lenovo LOQ est le seul de la sélection dans ce cas.

Ces recommandations sont les miennes, à partir des configurations et des prix affichés dans le catalogue. Elles ne remplacent pas un essai en magasin ni la vérification de la fiche technique exacte.

## Avant d'acheter : la checklist

<li>Vérifiez la référence exacte du processeur (génération incluse), pas seulement « i3 », « i5 » ou « i7 ».</li>
<li>Confirmez la quantité de RAM et son éventuelle extensibilité sur la fiche du fabricant.</li>
<li>Regardez la capacité du SSD, mais aussi sa technologie si elle est précisée.</li>
<li>Testez le clavier, le poids et la taille de l'écran si vous achetez en magasin.</li>
<li>Demandez la durée de garantie et les conditions de retour.</li>
<li>Vérifiez le prix final en caisse : les offres du catalogue sont valables pendant la période indiquée, dans la limite des stocks.</li>

Pour comparer avec les autres promotions du moment, consultez la page des [promotions Marjane](/promotions-marjane) et le [catalogue en cours](/catalogue-marjane/${catalogueSlug}).

Prix relevés le 20 octobre 2026 dans le catalogue Marjane. Ils sont indicatifs et peuvent changer : vérifiez toujours le prix et la disponibilité en magasin ou sur le site officiel de Marjane avant d'acheter.`;
}

const FAQ = JSON.stringify([
  {
    question: "Quel processeur choisir entre i3, i5 et i7 pour un PC portable ?",
    answer:
      "Un i3 convient à la bureautique et au web, un i5 est le choix polyvalent pour les études et la famille, et un i7 se justifie pour le montage, le développement ou plusieurs applications lourdes. La génération du processeur et le refroidissement comptent autant que la gamme.",
  },
  {
    question: "8 Go de RAM suffisent-ils en 2026 ?",
    answer:
      "Pour un usage simple, oui, mais la marge est faible. 16 Go sont recommandés pour garder plusieurs applications et onglets ouverts et pour conserver le PC plusieurs années.",
  },
  {
    question: "Quel PC portable pour un étudiant avec un budget serré ?",
    answer:
      "Le HP 250 Core i3 à 5 499 DH convient aux usages de base. Si le budget le permet, le MSI Core i5 à 7 299 DH offre 16 Go de RAM et 512 Go de SSD, plus confortables sur la durée.",
  },
  {
    question: "Les prix du catalogue Marjane sont-ils valables en ligne ?",
    answer:
      "Les prix cités proviennent du catalogue Marjane. Ils sont valables pendant la période indiquée, dans la limite des stocks, et doivent être vérifiés en magasin ou sur le site officiel de Marjane avant tout achat.",
  },
  {
    question: "256 Go de SSD suffisent-ils ?",
    answer:
      "C'est juste après l'installation de Windows et des logiciels. 512 Go est plus confortable pour la plupart des usages, et 1 To se justifie pour les vidéos, les jeux ou de gros fichiers.",
  },
]);

async function main() {
  const prisma = new PrismaClient();
  try {
    const catalogue =
      (await prisma.catalogue.findFirst({
        where: { slug: ARTICLE_SLUG },
        select: { id: true, slug: true, title: true, startDate: true, endDate: true },
      })) ??
      (await prisma.catalogue.findFirst({
        where: { status: "PUBLISHED" },
        orderBy: { startDate: "desc" },
        select: { id: true, slug: true, title: true, startDate: true, endDate: true },
      }));

    if (!catalogue) {
      throw new Error("No published catalogue found.");
    }

    const fmt = (d: Date) =>
      d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
    const dates = `${fmt(catalogue.startDate)} au ${fmt(catalogue.endDate)}`;
    const content = buildContent(catalogue.slug, catalogue.title, dates);

    const data = {
      title: TITLE,
      slug: SLUG,
      metaTitle: TITLE,
      metaDescription: META_DESCRIPTION,
      author: "Soufiane",
      excerpt: EXCERPT,
      content,
      primaryKeyword: "PC portable Maroc 2026",
      secondaryKeywords:
        "guide achat PC portable Maroc, PC portable i3 i5 i7, promotions Marjane informatique, RAM SSD",
      searchIntent: "commercial_investigation",
      catalogueId: catalogue.id,
      articleType: "buying_guide",
      articleFocus: "Informatique",
      status: "PUBLISHED",
      faq: FAQ,
    };

    const existing = await prisma.article.findUnique({
      where: { slug: SLUG },
      select: { id: true, publishedAt: true },
    });

    const article = existing
      ? await prisma.article.update({
          where: { id: existing.id },
          data: { ...data, publishedAt: existing.publishedAt ?? new Date() },
        })
      : await prisma.article.create({
          data: { ...data, publishedAt: new Date() },
        });

    const category = await prisma.category.findFirst({
      where: { OR: [{ slug: "high-tech" }, { name: "High-Tech" }] },
      select: { id: true, name: true },
    });
    if (category) {
      await prisma.articleCategory.deleteMany({ where: { articleId: article.id } });
      await prisma.articleCategory.create({
        data: { articleId: article.id, categoryId: category.id },
      });
    }

    console.log(`Article ${existing ? "updated" : "created"}: /articles/${article.slug}`);
    console.log(`Author: ${article.author}`);
    console.log(`Catalogue: ${catalogue.title} (${dates})`);
    if (category) console.log(`Category: ${category.name}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
