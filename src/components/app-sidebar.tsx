"use client";

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarRail,
} from '@/components/ui/sidebar';
import {
  LayoutDashboard,
  Boxes,
  Users,
  LineChart,
  Warehouse,
  ShoppingCart,
  Menu,
  Contact,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Button } from './ui/button';

const menuItems = [
  { href: '/', label: 'Tableau de bord', icon: LayoutDashboard },
];

const articlesSubMenuItems = [
    { href: '/articles', label: 'Liste Articles' },
    { href: '/articles/families', label: 'Famille Articles' },
    { href: '/articles/discounts', label: 'Remises' },
]

const achatSubMenuItems = [
    { href: '/purchases/orders', label: 'Bons de commande' },
    { href: '/purchases/receipts', label: 'Bons de réception' },
    { href: '/purchases/invoices', label: 'Factures' },
    { href: '/purchases/credit-notes', label: 'Avoirs' },
];

const tiersSubMenuItems = [
    { href: '/clients', label: 'Clients', icon: Contact },
    { href: '/prospects', label: 'Prospects', icon: UserPlus },
    { href: '/suppliers', label: 'Fournisseurs', icon: Warehouse },
    { href: '/representants', label: 'Représentants', icon: UserCheck },
]

export function AppSidebar() {
  const pathname = usePathname();
  const [isArticlesOpen, setIsArticlesOpen] = React.useState(
    articlesSubMenuItems.some(item => pathname.startsWith(item.href))
  );
  const [isAchatOpen, setIsAchatOpen] = React.useState(
    achatSubMenuItems.some(item => pathname.startsWith(item.href))
  );
  const [isTiersOpen, setIsTiersOpen] = React.useState(
    tiersSubMenuItems.some(item => pathname.startsWith(item.href))
  );

  return (
    <>
      <SidebarRail />
      <SidebarHeader className="pb-[50px] pt-[50px]">
        <div className="flex items-center gap-2 p-2 justify-between group-data-[collapsible=icon]:justify-center">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <Warehouse className="size-5" />
            </div>
            <span className="text-lg font-semibold text-sidebar-foreground group-data-[collapsible=icon]:hidden">
              GérerStock
            </span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {menuItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                isActive={pathname === item.href}
                className="justify-start"
                tooltip={item.label}
              >
                <Link href={item.href}>
                  <item.icon className="size-4" />
                  <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
           <Collapsible open={isArticlesOpen} onOpenChange={setIsArticlesOpen}>
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="justify-start w-full gap-2 p-2 h-8 text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-2">
                      <Boxes className="size-4" />
                      <span className="group-data-[collapsible=icon]:hidden flex-1 text-left">Articles</span>
                      <Menu className="size-4 group-data-[collapsible=icon]:hidden" />
                  </Button>
              </CollapsibleTrigger>
            </SidebarMenuItem>
             <CollapsibleContent>
                <SidebarMenuSub>
                    {articlesSubMenuItems.map(subItem => (
                        <SidebarMenuItem key={subItem.href}>
                            <SidebarMenuSubButton asChild isActive={pathname.startsWith(subItem.href)}>
                                <Link href={subItem.href}>
                                    {subItem.label}
                                </Link>
                            </SidebarMenuSubButton>
                        </SidebarMenuItem>
                    ))}
                </SidebarMenuSub>
            </CollapsibleContent>
          </Collapsible>
          <Collapsible open={isTiersOpen} onOpenChange={setIsTiersOpen}>
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="justify-start w-full gap-2 p-2 h-8 text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-2">
                      <Users className="size-4" />
                      <span className="group-data-[collapsible=icon]:hidden flex-1 text-left">Tiers</span>
                      <Menu className="size-4 group-data-[collapsible=icon]:hidden" />
                  </Button>
              </CollapsibleTrigger>
            </SidebarMenuItem>
             <CollapsibleContent>
                <SidebarMenuSub>
                    {tiersSubMenuItems.map(subItem => (
                        <SidebarMenuItem key={subItem.href}>
                            <SidebarMenuSubButton asChild isActive={pathname.startsWith(subItem.href)}>
                                <Link href={subItem.href}>
                                    {subItem.label}
                                </Link>
                            </SidebarMenuSubButton>
                        </SidebarMenuItem>
                    ))}
                </SidebarMenuSub>
            </CollapsibleContent>
          </Collapsible>
          <Collapsible open={isAchatOpen} onOpenChange={setIsAchatOpen}>
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="justify-start w-full gap-2 p-2 h-8 text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-2">
                      <ShoppingCart className="size-4" />
                      <span className="group-data-[collapsible=icon]:hidden flex-1 text-left">Achats</span>
                      <Menu className="size-4 group-data-[collapsible=icon]:hidden" />
                  </Button>
              </CollapsibleTrigger>
            </SidebarMenuItem>
             <CollapsibleContent>
                <SidebarMenuSub>
                    {achatSubMenuItems.map(subItem => (
                        <SidebarMenuItem key={subItem.href}>
                            <SidebarMenuSubButton asChild isActive={pathname === subItem.href}>
                                <Link href={subItem.href}>
                                    {subItem.label}
                                </Link>
                            </SidebarMenuSubButton>
                        </SidebarMenuItem>
                    ))}
                </SidebarMenuSub>
            </CollapsibleContent>
          </Collapsible>
          <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={pathname === '/reports'}
                className="justify-start"
                tooltip={'Rapports'}
              >
                <Link href={'/reports'}>
                  <LineChart className="size-4" />
                  <span className="group-data-[collapsible=icon]:hidden">Rapports</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>
    </>
  );
}
