---- MODULE Probe ----
EXTENDS Naturals, Sequences, FiniteSets, TLC
CONSTANTS Prefix, Ending, Cases, Mutate
VARIABLES case, cursor, pending, response, output, result, active,
          resolutions, timedOut, timeoutCursor, timeoutOutput
vars == <<case, cursor, pending, response, output, result, active,
          resolutions, timedOut, timeoutCursor, timeoutOutput>>
Empty == <<>>
Slice(s, a, b) == IF a > b THEN Empty ELSE SubSeq(s, a, b)
Starts(s, p) == Len(s) >= Len(p) /\ Slice(s, 1, Len(p)) = p
Positions(s, p) == {i \in 1..Len(s) : Starts(Slice(s, i, Len(s)), p)}
First(s, p) == IF Positions(s, p) = {} THEN 0
               ELSE CHOOSE i \in Positions(s, p) : \A j \in Positions(s, p) : i <= j
Suffixes(s) == {n \in 0..(IF Len(s) < Len(Prefix) THEN Len(s) ELSE Len(Prefix)-1) :
                Slice(s, Len(s)-n+1, Len(s)) = Slice(Prefix, 1, n)}
SuffixLength(s) == CHOOSE n \in Suffixes(s) : \A m \in Suffixes(s) : n >= m
Keep(s) == Slice(s, Len(s)-SuffixLength(s)+1, Len(s))
Pass(s) == Slice(s, 1, Len(s)-SuffixLength(s))
Init == /\ case \in Cases
        /\ cursor = 0 /\ pending = Empty /\ response = Empty /\ output = Empty
        /\ result = "pending" /\ active = TRUE /\ resolutions = 0
        /\ timedOut = FALSE /\ timeoutCursor = 0 /\ timeoutOutput = Empty
Input == \E stop \in (cursor+1)..Len(case.wire) :
  LET data == Slice(case.wire, cursor+1, stop)
      candidate == pending \o data
      start == First(candidate, Prefix)
      acceptedStart == start
      collected == IF Len(response) > 0 THEN response \o data
                   ELSE IF acceptedStart > 0 THEN Slice(candidate, acceptedStart, Len(candidate))
                   ELSE Empty
      leading == IF Len(response) > 0 THEN Empty
                 ELSE IF acceptedStart > 0 THEN Slice(candidate, 1, acceptedStart-1)
                 ELSE IF Mutate /\ SuffixLength(candidate) < 3 THEN candidate ELSE Pass(candidate)
      end == First(collected, Ending)
      value == Slice(collected, Len(Prefix)+1, end-1)
      trailing == Slice(collected, end+Len(Ending), Len(collected))
  IN /\ cursor' = stop
     /\ IF ~active THEN
          /\ output' = output \o data
          /\ UNCHANGED <<pending, response, result, active, resolutions>>
        ELSE
          /\ output' = output \o leading \o (IF end > 0 THEN trailing ELSE Empty)
          /\ pending' = IF Len(collected) > 0 THEN Empty
                         ELSE IF Mutate /\ SuffixLength(candidate) < 3 THEN Empty ELSE Keep(candidate)
          /\ response' = collected
          /\ result' = IF end = 0 THEN result
                        ELSE IF value = <<79,75>> THEN "image" ELSE "text"
          /\ active' = (end = 0)
          /\ resolutions' = resolutions + (IF end > 0 THEN 1 ELSE 0)
     /\ UNCHANGED <<case, timedOut, timeoutCursor, timeoutOutput>>
Timeout == /\ active
           /\ result' = "text" /\ active' = FALSE /\ resolutions' = resolutions+1
           /\ timedOut' = TRUE /\ timeoutCursor' = cursor /\ timeoutOutput' = output
           /\ UNCHANGED <<case, cursor, pending, response, output>>
Next == Input \/ Timeout
SettlesOnce == resolutions <= 1
ListenerReleased == (result # "pending") => ~active
CompleteInput == (cursor = Len(case.wire) /\ ~timedOut /\ case.path # "pending")
                 => (result = case.path /\ output = case.user)
UnmatchedInput == (cursor = Len(case.wire) /\ ~timedOut /\ case.path = "pending")
                  => (result = "pending" /\ response = Empty /\ output \o pending = case.wire)
NoPrematureSuccess == (result = "image") => (cursor >= case.finish)
TimeoutBeforeFrame == (timedOut /\ timeoutCursor < case.start)
  => timeoutOutput = Pass(Slice(case.wire, 1, timeoutCursor))
TimeoutInFrame == (timedOut /\ timeoutCursor >= case.start /\ case.start > 0)
  => timeoutOutput = Slice(case.wire, 1, case.start-1)
TimeoutTail == timedOut => output = timeoutOutput \o Slice(case.wire, timeoutCursor+1, cursor)
EventuallySettled == <>(result # "pending")
Spec == Init /\ [][Next]_vars /\ WF_vars(Timeout)
====
