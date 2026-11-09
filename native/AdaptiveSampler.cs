using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Imaging;
using System.Linq;
using System.Runtime.InteropServices;
using System.Threading;
using System.Web.Script.Serialization;

// Only statistics leave this process. Pixel buffers are transient and never written to disk.
internal static class AdaptiveSampler {
 [StructLayout(LayoutKind.Sequential)] internal struct RECT { public int Left,Top,Right,Bottom; public int Width { get { return Right-Left; } } public int Height { get { return Bottom-Top; } } }
 internal sealed class Request { public string hwnd; public string[] exclude; }
 internal sealed class WindowInfo { public IntPtr Handle; public RECT Rect; }
 internal sealed class PointInfo { public int X,Y; public IntPtr Source; public Color Color,PeakColor; public double Luma; public bool Detail; }
 delegate bool EnumProc(IntPtr hwnd,IntPtr param);
 [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc callback,IntPtr param);
 [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr hwnd);
 [DllImport("user32.dll")] static extern bool IsIconic(IntPtr hwnd);
 [DllImport("user32.dll")] static extern bool IsHungAppWindow(IntPtr hwnd);
 [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr hwnd,out RECT rect);
 [DllImport("user32.dll")] static extern bool PrintWindow(IntPtr hwnd,IntPtr dc,uint flags);
 [DllImport("user32.dll")] static extern bool GetWindowDisplayAffinity(IntPtr hwnd,out uint affinity);
 [DllImport("user32.dll")] static extern bool SetProcessDpiAwarenessContext(IntPtr context);
 [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr hwnd,int attribute,out int value,int size);
 static double Linear(double v) { v/=255;return v<=.04045?v/12.92:Math.Pow((v+.055)/1.055,2.4); }
 static double Luma(Color c) { return .2126*Linear(c.R)+.7152*Linear(c.G)+.0722*Linear(c.B); }
 static IntPtr Handle(string value) { return new IntPtr(Convert.ToInt64(value,16)); }
 static object Fail(string reason) { return new {ok=false,reason=reason}; }
 static object Sample(Request request) {
  Stopwatch watch=Stopwatch.StartNew();
  IntPtr target=Handle(request.hwnd); RECT targetRect;
  if(!IsWindowVisible(target)||IsIconic(target)||!GetWindowRect(target,out targetRect)||targetRect.Width<32||targetRect.Height<32)return Fail("window-not-visible");
  HashSet<IntPtr> excluded=new HashSet<IntPtr>((request.exclude??new string[0]).Select(Handle));excluded.Add(target);
  List<WindowInfo> behind=new List<WindowInfo>();bool seen=false;
  EnumWindows(delegate(IntPtr hwnd,IntPtr unused) {
   if(hwnd==target){seen=true;return true;}
   if(!seen||excluded.Contains(hwnd)||!IsWindowVisible(hwnd)||IsIconic(hwnd))return true;
   int cloaked=0;DwmGetWindowAttribute(hwnd,14,out cloaked,4);if(cloaked!=0)return true;
   RECT r;if(!GetWindowRect(hwnd,out r)||r.Width<8||r.Height<8||r.Right<=targetRect.Left||r.Left>=targetRect.Right||r.Bottom<=targetRect.Top||r.Top>=targetRect.Bottom)return true;
   behind.Add(new WindowInfo {Handle=hwnd,Rect=r});return true;
  },IntPtr.Zero);
  if(!seen)return Fail("window-not-enumerated");
  List<PointInfo> points=new List<PointInfo>();
  const int columns=32,rows=20;
  for(int y=0;y<rows;y++)for(int x=0;x<columns;x++){
   int px=targetRect.Left+8+(int)((targetRect.Width-16)*(x+.5)/columns),py=targetRect.Top+8+(int)((targetRect.Height-16)*(y+.5)/rows);
   WindowInfo source=behind.FirstOrDefault(w=>px>=w.Rect.Left&&px<w.Rect.Right&&py>=w.Rect.Top&&py<w.Rect.Bottom);
   if(source==null)return Fail("background-unavailable");
   points.Add(new PointInfo {X=px,Y=py,Source=source.Handle});
  }
  var groups=points.GroupBy(p=>p.Source).ToArray();
  if(groups.Length>6)return Fail("background-too-fragmented");
  foreach(var group in groups){
   WindowInfo window=behind.First(w=>w.Handle==group.Key);RECT r=window.Rect;
   uint affinity=0;if(GetWindowDisplayAffinity(window.Handle,out affinity)&&affinity!=0)return Fail("background-capture-protected");
   if(IsHungAppWindow(window.Handle))return Fail("background-not-responding");
   if((long)r.Width*r.Height>16000000)return Fail("background-too-large");
   using(Bitmap bitmap=new Bitmap(r.Width,r.Height,PixelFormat.Format32bppArgb)){
    using(Graphics graphics=Graphics.FromImage(bitmap)){
     graphics.Clear(Color.Magenta);IntPtr dc=graphics.GetHdc();bool printed;
     try{printed=PrintWindow(window.Handle,dc,2);}finally{graphics.ReleaseHdc(dc);}
     if(!printed)return Fail("window-capture-failed");
    }
    int sentinel=0;
    foreach(PointInfo point in group){
     int bx=point.X-r.Left,by=point.Y-r.Top;point.Color=bitmap.GetPixel(bx,by);point.Luma=Luma(point.Color);point.PeakColor=point.Color;double minimum=point.Luma,maximum=point.Luma;
     for(int dy=-8;dy<=8;dy+=4)for(int dx=-8;dx<=8;dx+=4){Color color=bitmap.GetPixel(Math.Max(0,Math.Min(r.Width-1,bx+dx)),Math.Max(0,Math.Min(r.Height-1,by+dy)));double luma=Luma(color);minimum=Math.Min(minimum,luma);if(luma>maximum){maximum=luma;point.PeakColor=color;}}
     point.Detail=maximum-minimum>.3&&maximum>.4;
     if(point.Color.R==255&&point.Color.G==0&&point.Color.B==255)sentinel++;
    }
    if(sentinel>group.Count()*.1)return Fail("window-did-not-render");
   }
  }
  if(points.Count(p=>p.Color.R<2&&p.Color.G<2&&p.Color.B<2)>points.Count*.99)return Fail("unverified-black-capture");
  var ordered=points.OrderBy(p=>p.Luma).ToArray();
  double brightFraction=(double)points.Count(p=>p.Luma>.65)/points.Count;
  PointInfo selected=ordered[(int)Math.Floor((ordered.Length-1)*(brightFraction>=.035?.97:.90))];
  Color peak=points.OrderBy(p=>Luma(p.PeakColor)).Last().PeakColor;
  return new {ok=true,mean=points.Average(p=>p.Luma),p90=ordered[(int)((ordered.Length-1)*.9)].Luma,brightFraction=brightFraction,detailFraction=(double)points.Count(p=>p.Detail)/points.Count,peakColor=new int[]{peak.R,peak.G,peak.B},referenceColor=new int[]{selected.Color.R,selected.Color.G,selected.Color.B},sampleCount=points.Count,windowCount=groups.Length,durationMs=watch.Elapsed.TotalMilliseconds};
 }
 public static void Main(){
  try{SetProcessDpiAwarenessContext(new IntPtr(-4));}catch{}
  JavaScriptSerializer json=new JavaScriptSerializer();
  string line;
  while((line=Console.ReadLine())!=null){
   object result=null;
   Thread worker=new Thread(delegate(){try{result=Sample(json.Deserialize<Request>(line));}catch(Exception error){result=Fail(error.GetType().Name);}});worker.IsBackground=true;worker.Start();
   if(!worker.Join(1100)){Console.WriteLine(json.Serialize(Fail("capture-timeout")));Console.Out.Flush();Environment.Exit(2);}
   Console.WriteLine(json.Serialize(result));Console.Out.Flush();
  }
 }
}
