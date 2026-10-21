using Battleship.Core.Protocol;
using Battleship.Server.Engine;
using Battleship.Server.Lobby;

namespace Battleship.Server.Host;

// Own profile requests (#42), following the history worker/reply pattern.
public sealed partial class GameHost
{
    private void OnProfile(PlayerRecord player, ProfileUpdate? update)
    {
        if (player.UserId is not long userId)
        {
            Send(new[] { Outbound.ToPlayer(player.Id, update == null ? new Profile() :
                new Error { Code = ErrorCodes.NotLoggedIn, Message = "Log in to save your profile." }) });
            return;
        }
        if (_database == null)
        {
            Send(new[] { Outbound.Error(player.Id, ErrorCodes.Unknown, "Profiles are temporarily unavailable.") });
            return;
        }
        string playerId = player.Id;
        _database.Enqueue(database =>
        {
            ProtocolMessage reply;
            try
            {
                if (update != null) database.SetProfile(userId, update.Avatar, update.ShownBadges);
                reply = database.GetProfile(userId);
            }
            catch (ArgumentException ex)
            {
                reply = new Error { Code = ErrorCodes.InvalidProfile, Message = ex.Message };
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Could not load or save profile for {playerId}: {ex.Message}");
                reply = new Error { Code = ErrorCodes.Unknown, Message = "Your profile couldn't be loaded or saved. Try again." };
            }
            Post(new HostInput.DatabaseReply(playerId, reply));
        });
    }
}
