using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;

namespace Battleship.Server.Net;

/// <summary>This machine's IPv4 LAN addresses, for the startup banner and the dashboard.</summary>
public static class LanAddresses
{
    public static IReadOnlyList<IPAddress> Get() =>
        NetworkInterface.GetAllNetworkInterfaces()
            .Where(nic => nic.OperationalStatus == OperationalStatus.Up &&
                          nic.NetworkInterfaceType != NetworkInterfaceType.Loopback)
            .SelectMany(nic => nic.GetIPProperties().UnicastAddresses)
            .Select(unicast => unicast.Address)
            .Where(address => address.AddressFamily == AddressFamily.InterNetwork &&
                              !IPAddress.IsLoopback(address) &&
                              !address.ToString().StartsWith("169.254.")) // no DHCP lease: unreachable
            .Distinct()
            .ToList();
}
