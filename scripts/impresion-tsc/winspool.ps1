param([Parameter(Mandatory = $true)][ValidateSet('Print', 'List', 'SelfTest')][string]$Action)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)

# No Invoke-Expression, shell commands, printer utilities or client scripts.
$nativeSource = @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;

public sealed class SpoolResult {
    public bool ok;
    public string stage = "Helper";
    public int win32;
    public uint jobId;
    public int bytesRequested;
    public int bytesWritten;
    public bool uncertain;
    public bool abortAttempted;
    public bool abortSucceeded;
    public string[] printers;
}

public static class GesgrowWinspool {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    struct DOC_INFO_1 {
        [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
    }
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    struct PRINTER_INFO_4 {
        [MarshalAs(UnmanagedType.LPWStr)] public string pPrinterName;
        [MarshalAs(UnmanagedType.LPWStr)] public string pServerName;
        public uint Attributes;
    }
    [DllImport("winspool.drv", EntryPoint="OpenPrinterW", CharSet=CharSet.Unicode, SetLastError=true)]
    [return: MarshalAs(UnmanagedType.Bool)] static extern bool OpenPrinter(string name, out IntPtr handle, IntPtr defaults);
    [DllImport("winspool.drv", EntryPoint="StartDocPrinterW", CharSet=CharSet.Unicode, SetLastError=true)]
    static extern uint StartDocPrinter(IntPtr handle, uint level, ref DOC_INFO_1 info);
    [DllImport("winspool.drv", SetLastError=true)]
    [return: MarshalAs(UnmanagedType.Bool)] static extern bool StartPagePrinter(IntPtr handle);
    [DllImport("winspool.drv", SetLastError=true)]
    [return: MarshalAs(UnmanagedType.Bool)] static extern bool WritePrinter(IntPtr handle, IntPtr buffer, uint length, out uint written);
    [DllImport("winspool.drv", SetLastError=true)]
    [return: MarshalAs(UnmanagedType.Bool)] static extern bool EndPagePrinter(IntPtr handle);
    [DllImport("winspool.drv", SetLastError=true)]
    [return: MarshalAs(UnmanagedType.Bool)] static extern bool EndDocPrinter(IntPtr handle);
    [DllImport("winspool.drv", SetLastError=true)]
    [return: MarshalAs(UnmanagedType.Bool)] static extern bool AbortPrinter(IntPtr handle);
    [DllImport("winspool.drv", SetLastError=true)]
    [return: MarshalAs(UnmanagedType.Bool)] static extern bool ClosePrinter(IntPtr handle);
    [DllImport("winspool.drv", EntryPoint="EnumPrintersW", CharSet=CharSet.Unicode, SetLastError=true)]
    [return: MarshalAs(UnmanagedType.Bool)] static extern bool EnumPrinters(uint flags, string name, uint level, IntPtr buffer, uint size, out uint needed, out uint returned);

    static SpoolResult Fail(SpoolResult result, string stage, int error) {
        result.ok = false; result.stage = stage; result.win32 = error;
        result.uncertain = result.jobId != 0;
        return result;
    }

    public static SpoolResult Print(string printer, byte[] bytes, string jobId) {
        var result = new SpoolResult { bytesRequested = bytes.Length };
        IntPtr handle = IntPtr.Zero;
        bool documentOpen = false;
        GCHandle pinned = new GCHandle();
        try {
            if (!OpenPrinter(printer, out handle, IntPtr.Zero)) return Fail(result, "OpenPrinter", Marshal.GetLastWin32Error());
            var doc = new DOC_INFO_1 { pDocName = "Gesgrow-" + jobId, pOutputFile = null, pDataType = "RAW" };
            result.jobId = StartDocPrinter(handle, 1, ref doc);
            if (result.jobId == 0) return Fail(result, "StartDocPrinter", Marshal.GetLastWin32Error());
            documentOpen = true;
            if (!StartPagePrinter(handle)) return Fail(result, "StartPagePrinter", Marshal.GetLastWin32Error());
            pinned = GCHandle.Alloc(bytes, GCHandleType.Pinned);
            while (result.bytesWritten < bytes.Length) {
                uint written;
                int remaining = bytes.Length - result.bytesWritten;
                bool success = WritePrinter(handle, IntPtr.Add(pinned.AddrOfPinnedObject(), result.bytesWritten), (uint)remaining, out written);
                int error = success ? 0 : Marshal.GetLastWin32Error();
                if (written > remaining) return Fail(result, "WritePrinter", 13);
                result.bytesWritten += (int)written;
                if (!success || written == 0) return Fail(result, "WritePrinter", success ? 29 : error);
            }
            if (!EndPagePrinter(handle)) return Fail(result, "EndPagePrinter", Marshal.GetLastWin32Error());
            if (!EndDocPrinter(handle)) return Fail(result, "EndDocPrinter", Marshal.GetLastWin32Error());
            documentOpen = false;
            result.ok = true; result.stage = "EndDocPrinter";
            return result;
        } catch {
            return Fail(result, "Helper", 0);
        } finally {
            if (pinned.IsAllocated) pinned.Free();
            if (documentOpen) {
                result.abortAttempted = true;
                result.abortSucceeded = AbortPrinter(handle);
            }
            if (handle != IntPtr.Zero && !ClosePrinter(handle) && result.ok) Fail(result, "ClosePrinter", Marshal.GetLastWin32Error());
        }
    }

    public static SpoolResult List() {
        var result = new SpoolResult();
        uint needed, returned;
        bool initial = EnumPrinters(6, null, 4, IntPtr.Zero, 0, out needed, out returned);
        int initialError = initial ? 0 : Marshal.GetLastWin32Error();
        if (!initial && initialError != 122) return Fail(result, "EnumPrinters", initialError);
        if (needed == 0) { result.ok = true; result.printers = new string[0]; return result; }
        if (needed > 4194304) return Fail(result, "EnumPrinters", 8);
        IntPtr buffer = Marshal.AllocHGlobal((int)needed);
        try {
            if (!EnumPrinters(6, null, 4, buffer, needed, out needed, out returned)) return Fail(result, "EnumPrinters", Marshal.GetLastWin32Error());
            var names = new List<string>();
            int size = Marshal.SizeOf(typeof(PRINTER_INFO_4));
            for (int i = 0; i < returned; i++) {
                var info = (PRINTER_INFO_4)Marshal.PtrToStructure(IntPtr.Add(buffer, i * size), typeof(PRINTER_INFO_4));
                if (!String.IsNullOrEmpty(info.pPrinterName)) names.Add(info.pPrinterName);
            }
            result.ok = true; result.printers = names.ToArray();
            return result;
        } finally { Marshal.FreeHGlobal(buffer); }
    }
}
'@

try {
    Add-Type -TypeDefinition $nativeSource -Language CSharp
    if ($Action -eq 'SelfTest') {
        # Compile only. Does not load a printer, enumerate queues or invoke native methods.
        [Console]::Out.WriteLine('{"ok":true,"compiled":true}')
        exit 0
    }
    if ($Action -eq 'List') {
        $result = [GesgrowWinspool]::List()
    } else {
        $reader = New-Object System.IO.BinaryReader([Console]::OpenStandardInput())
        $metadataLength = $reader.ReadInt32()
        if ($metadataLength -lt 1 -or $metadataLength -gt 4096) { throw 'Invalid metadata' }
        $metadata = $reader.ReadBytes($metadataLength)
        if ($metadata.Length -ne $metadataLength) { throw 'Incomplete metadata' }
        $job = ConvertFrom-Json -InputObject ([System.Text.Encoding]::UTF8.GetString($metadata))
        if ($job.printer -isnot [string] -or $job.printer.Length -lt 1 -or $job.printer.Length -gt 200 -or $job.printer -match '[\x00-\x1f\x7f]') { throw 'Invalid printer' }
        if ($job.jobId -isnot [string] -or $job.jobId -notmatch '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$') { throw 'Invalid job' }
        if ($job.bytesRequested -isnot [int] -and $job.bytesRequested -isnot [long]) { throw 'Invalid length' }
        if ($job.bytesRequested -lt 1 -or $job.bytesRequested -gt 104857600) { throw 'Invalid length' }
        $bytes = $reader.ReadBytes([int]$job.bytesRequested)
        if ($bytes.Length -ne $job.bytesRequested -or $reader.BaseStream.ReadByte() -ne -1) { throw 'Incomplete or extra bytes' }
        $result = [GesgrowWinspool]::Print($job.printer, $bytes, $job.jobId)
    }
    [Console]::Out.WriteLine((ConvertTo-Json -InputObject $result -Compress -Depth 4))
    if (-not $result.ok) { exit 1 }
} catch {
    # Do not print PowerShell exception messages, input bytes or paths.
    [Console]::Out.WriteLine('{"ok":false,"stage":"Helper","win32":0,"uncertain":true,"bytesWritten":null}')
    exit 1
}
