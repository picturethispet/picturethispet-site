import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Camera, ShoppingCart, Download, Plus, Minus, Heart, Check } from 'lucide-react';
import type { GalleryPhoto, PrintSize, CartItem, ClientSession } from '@shared/schema';

export default function GalleryPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [session, setSession] = useState<ClientSession | null>(null);
  const [loginData, setLoginData] = useState({ sessionId: '', email: '' });
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<GalleryPhoto | null>(null);
  const [isOrderComplete, setIsOrderComplete] = useState(false);
  const { toast } = useToast();

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async (data: { sessionId?: string; email?: string }) => {
      const response = await apiRequest('POST', '/api/gallery/login', data);
      return response.json();
    },
    onSuccess: (data) => {
      setSession(data.session);
      setIsAuthenticated(true);
      toast({
        title: "Welcome to Your Gallery",
        description: `Hi ${data.session.clientName}! Your photos are ready to view.`,
      });
    },
    onError: () => {
      toast({
        title: "Access Denied",
        description: "Please check your session ID or email and try again.",
        variant: "destructive",
      });
    }
  });

  // Photos query
  const { data: photosData, isLoading: photosLoading } = useQuery({
    queryKey: ['/api/gallery', session?.sessionId, 'photos'],
    enabled: !!session?.sessionId,
  });

  // Print sizes query
  const { data: printSizesData } = useQuery({
    queryKey: ['/api/gallery/print-sizes'],
    enabled: isAuthenticated,
  });

  // Order mutation
  const orderMutation = useMutation({
    mutationFn: async (orderData: { sessionId: string; items: CartItem[]; totalAmount: number }) => {
      const response = await apiRequest('POST', '/api/gallery/orders', orderData);
      return response.json();
    },
    onSuccess: async (data) => {
      // Mock payment process
      const paymentResponse = await apiRequest('POST', '/api/gallery/payment', {
        orderNumber: data.order.orderNumber,
        amount: data.order.totalAmount
      });
      
      // Mock lab submission
      await apiRequest('POST', '/api/gallery/submit-to-lab', {
        orderNumber: data.order.orderNumber,
        items: cart
      });
      
      // Mock Google Sheets logging
      await apiRequest('POST', '/api/gallery/log-order', {
        orderData: { ...data.order, session, cart }
      });
      
      setIsOrderComplete(true);
      setCart([]);
      toast({
        title: "Order Placed Successfully!",
        description: `Order ${data.order.orderNumber} is being processed. You'll receive updates via email.`,
      });
    }
  });

  const handleLogin = () => {
    if (!loginData.sessionId && !loginData.email) {
      toast({
        title: "Missing Information",
        description: "Please enter either your session ID or email address.",
        variant: "destructive",
      });
      return;
    }
    loginMutation.mutate(loginData);
  };

  const addToCart = (photo: GalleryPhoto, size: string, price: number) => {
    const existingItem = cart.find(item => item.photoId === photo.id && item.size === size);
    
    if (existingItem) {
      setCart(cart.map(item => 
        item.photoId === photo.id && item.size === size
          ? { ...item, quantity: item.quantity + 1, totalPrice: (item.quantity + 1) * item.unitPrice }
          : item
      ));
    } else {
      setCart([...cart, {
        photoId: photo.id,
        photoUrl: photo.imageUrl,
        size,
        quantity: 1,
        unitPrice: price,
        totalPrice: price
      }]);
    }
    
    toast({
      title: "Added to Cart",
      description: `${size} print of ${photo.caption || photo.filename} added to cart.`,
    });
  };

  const updateCartQuantity = (photoId: number, size: string, change: number) => {
    setCart(cart.map(item => {
      if (item.photoId === photoId && item.size === size) {
        const newQuantity = Math.max(0, item.quantity + change);
        if (newQuantity === 0) {
          return null;
        }
        return { ...item, quantity: newQuantity, totalPrice: newQuantity * item.unitPrice };
      }
      return item;
    }).filter(Boolean) as CartItem[]);
  };

  const removeFromCart = (photoId: number, size: string) => {
    setCart(cart.filter(item => !(item.photoId === photoId && item.size === size)));
  };

  const getTotalAmount = () => {
    return cart.reduce((total, item) => total + item.totalPrice, 0);
  };

  const handleCheckout = () => {
    if (cart.length === 0) {
      toast({
        title: "Empty Cart",
        description: "Please add some prints to your cart before checking out.",
        variant: "destructive",
      });
      return;
    }
    
    orderMutation.mutate({
      sessionId: session!.sessionId,
      items: cart,
      totalAmount: Math.round(getTotalAmount() * 100) // Convert to cents
    });
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen ptp-card-background flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Card className="glass-card border-white/10">
            <CardContent className="p-8">
              <div className="text-center mb-8">
                <Camera className="h-16 w-16 mx-auto mb-4 text-orange-400" />
                <h1 className="text-3xl font-bold gradient-text mb-2">
                  Your Photo Gallery
                </h1>
                <p className="text-white/80">
                  Enter your session details to view and order your photos
                </p>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white/90 mb-2">
                    Session ID
                  </label>
                  <Input
                    type="text"
                    placeholder="e.g., PTP-2024-001"
                    value={loginData.sessionId}
                    onChange={(e) => setLoginData({ ...loginData, sessionId: e.target.value })}
                    className="bg-white/5 border-white/20 text-white placeholder:text-white/50"
                  />
                </div>
                
                <div className="text-center text-white/60 text-sm">— OR —</div>
                
                <div>
                  <label className="block text-sm font-medium text-white/90 mb-2">
                    Email Address
                  </label>
                  <Input
                    type="email"
                    placeholder="your@email.com"
                    value={loginData.email}
                    onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                    className="bg-white/5 border-white/20 text-white placeholder:text-white/50"
                  />
                </div>
                
                <Button 
                  onClick={handleLogin} 
                  disabled={loginMutation.isPending}
                  className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold py-3"
                >
                  {loginMutation.isPending ? "Accessing Gallery..." : "Access My Gallery"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isOrderComplete) {
    return (
      <div className="min-h-screen ptp-card-background flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <Card className="glass-card border-white/10">
            <CardContent className="p-8">
              <div className="text-center">
                <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Check className="h-10 w-10 text-green-400" />
                </div>
                <h1 className="text-3xl font-bold gradient-text mb-4">
                  Order Complete!
                </h1>
                <p className="text-white/80 mb-6">
                  Thank you for your order! Your prints are being processed and you'll receive tracking information via email.
                </p>
                <Button 
                  onClick={() => {
                    setIsOrderComplete(false);
                    setCart([]);
                  }}
                  className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white"
                >
                  View Gallery Again
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const photos = photosData?.photos || [];
  const printSizes = printSizesData?.printSizes || [];

  return (
    <div className="min-h-screen ptp-card-background">
      {/* Header */}
      <div className="bg-black/20 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold gradient-text">
                {session?.clientName}'s Gallery
              </h1>
              <p className="text-white/70 text-sm">
                {session?.sessionType === 'full' ? 'Full Session' : 'Mini Session'} • {session?.sessionDate} • {session?.location}
              </p>
            </div>
            
            {cart.length > 0 && (
              <div className="flex items-center gap-4">
                <Badge variant="secondary" className="bg-orange-500/20 text-orange-300 border-orange-500/30">
                  <ShoppingCart className="h-4 w-4 mr-1" />
                  {cart.length} {cart.length === 1 ? 'item' : 'items'}
                </Badge>
                <Button
                  onClick={handleCheckout}
                  disabled={orderMutation.isPending}
                  className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white"
                >
                  {orderMutation.isPending ? "Processing..." : `Checkout $${getTotalAmount().toFixed(2)}`}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {photosLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="glass-card border-white/10 rounded-xl overflow-hidden">
                <div className="aspect-[4/3] bg-white/5 animate-pulse" />
                <div className="p-4">
                  <div className="h-4 bg-white/10 rounded animate-pulse mb-2" />
                  <div className="h-6 bg-white/10 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {photos.map((photo: GalleryPhoto) => (
              <Card key={photo.id} className="glass-card border-white/10 overflow-hidden group hover:scale-105 transition-all duration-300">
                <div className="relative">
                  <img
                    src={photo.imageUrl}
                    alt={photo.caption || photo.filename}
                    className="w-full aspect-[4/3] object-cover"
                    onClick={() => setSelectedPhoto(photo)}
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300 cursor-pointer" />
                  <Button
                    variant="secondary"
                    size="sm"
                    className="absolute top-3 right-3 bg-white/10 hover:bg-white/20 text-white border-white/20 opacity-0 group-hover:opacity-100 transition-all duration-300"
                    onClick={() => setSelectedPhoto(photo)}
                  >
                    <Heart className="h-4 w-4" />
                  </Button>
                </div>
                
                <CardContent className="p-4">
                  <p className="text-white/90 text-sm mb-3">
                    {photo.caption || photo.filename}
                  </p>
                  
                  <div className="grid grid-cols-2 gap-2">
                    {printSizes.slice(0, 4).map((size: PrintSize) => (
                      <Button
                        key={size.size}
                        variant="outline"
                        size="sm"
                        onClick={() => addToCart(photo, size.size, size.price)}
                        className="bg-white/5 hover:bg-orange-500/20 text-white border-white/20 hover:border-orange-500/50 text-xs"
                      >
                        {size.size} - ${size.price}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Cart Summary */}
        {cart.length > 0 && (
          <Card className="glass-card border-white/10 mt-8">
            <CardContent className="p-6">
              <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
                <ShoppingCart className="h-5 w-5 mr-2 text-orange-400" />
                Your Cart
              </h3>
              
              <div className="space-y-3">
                {cart.map((item, index) => {
                  const photo = photos.find((p: GalleryPhoto) => p.id === item.photoId);
                  return (
                    <div key={index} className="flex items-center justify-between bg-white/5 rounded-lg p-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={item.photoUrl}
                          alt=""
                          className="w-12 h-12 object-cover rounded"
                        />
                        <div>
                          <p className="text-white text-sm">
                            {photo?.caption || photo?.filename}
                          </p>
                          <p className="text-white/60 text-xs">
                            {item.size} print
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateCartQuantity(item.photoId, item.size, -1)}
                          className="h-8 w-8 p-0 bg-white/5 border-white/20 text-white hover:bg-red-500/20"
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="text-white min-w-[2ch] text-center">
                          {item.quantity}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateCartQuantity(item.photoId, item.size, 1)}
                          className="h-8 w-8 p-0 bg-white/5 border-white/20 text-white hover:bg-green-500/20"
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        <span className="text-white ml-3 min-w-[4ch] text-right">
                          ${item.totalPrice.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              <div className="border-t border-white/20 pt-4 mt-4">
                <div className="flex justify-between items-center text-white font-semibold text-lg">
                  <span>Total:</span>
                  <span>${getTotalAmount().toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Photo Modal */}
      {selectedPhoto && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="relative max-w-4xl w-full">
            <img
              src={selectedPhoto.imageUrl}
              alt={selectedPhoto.caption || selectedPhoto.filename}
              className="w-full h-auto max-h-[80vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            <Button
              variant="secondary"
              className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white"
              onClick={() => setSelectedPhoto(null)}
            >
              ✕
            </Button>
            
            <div className="absolute bottom-4 left-4 right-4 bg-black/50 backdrop-blur-sm rounded-lg p-4">
              <p className="text-white mb-3">
                {selectedPhoto.caption || selectedPhoto.filename}
              </p>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                {printSizes.map((size: PrintSize) => (
                  <Button
                    key={size.size}
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      addToCart(selectedPhoto, size.size, size.price);
                    }}
                    className="bg-white/10 hover:bg-orange-500/20 text-white border-white/20 hover:border-orange-500/50 text-xs"
                  >
                    {size.size}<br />${size.price}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
